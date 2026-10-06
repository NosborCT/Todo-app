//! Ephemeral microphone capture. Only the reviewed task is persisted.
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::State;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

const MODEL_SIZE: u64 = 147951465;
const MODEL_HASH: &str = "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe";
const MODEL_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    phase: String,
    progress: u32,
    seconds: u64,
    text: String,
    error: Option<String>,
    model_ready: bool,
}
struct Inner {
    snapshot: Snapshot,
    busy: bool,
}
pub struct VoiceState {
    inner: Arc<Mutex<Inner>>,
    cancel: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
    model: PathBuf,
}
impl VoiceState {
    pub fn new(folder: PathBuf) -> Self {
        let model = folder.join("voice/ggml-base.bin");
        let ready = model.metadata().is_ok_and(|m| m.len() == MODEL_SIZE);
        Self {
            inner: Arc::new(Mutex::new(Inner {
                snapshot: Snapshot {
                    phase: "idle".into(),
                    progress: 0,
                    seconds: 0,
                    text: String::new(),
                    error: None,
                    model_ready: ready,
                },
                busy: false,
            })),
            cancel: Arc::new(AtomicBool::new(false)),
            stop: Arc::new(AtomicBool::new(false)),
            model,
        }
    }
    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::SeqCst);
    }
}
#[tauri::command]
pub fn voice_status(state: State<VoiceState>) -> Result<Snapshot, String> {
    Ok(state
        .inner
        .lock()
        .map_err(|_| "Voz indisponível")?
        .snapshot
        .clone())
}
#[tauri::command]
pub fn voice_stop(state: State<VoiceState>) {
    state.stop.store(true, Ordering::SeqCst);
}
#[tauri::command]
pub fn voice_cancel(state: State<VoiceState>) {
    state.cancel();
    if let Ok(mut inner) = state.inner.lock() {
        inner.snapshot.text.clear();
        if !inner.busy {
            inner.snapshot.phase = "idle".into();
        }
    }
}
#[tauri::command]
pub fn voice_begin(download: bool, state: State<VoiceState>) -> Result<(), String> {
    let mut inner = state.inner.lock().map_err(|_| "Voz indisponível")?;
    if inner.busy {
        return Err("Aguarde o encerramento da operação anterior.".into());
    }
    if !download && !inner.snapshot.model_ready {
        return Err("Instale o modelo de voz primeiro.".into());
    }
    inner.busy = true;
    inner.snapshot.phase = if download { "downloading" } else { "starting" }.into();
    inner.snapshot.error = None;
    inner.snapshot.text.clear();
    inner.snapshot.seconds = 0;
    inner.snapshot.progress = 0;
    state.cancel.store(false, Ordering::SeqCst);
    state.stop.store(false, Ordering::SeqCst);
    let shared = state.inner.clone();
    let cancel = state.cancel.clone();
    let stop = state.stop.clone();
    let model = state.model.clone();
    std::thread::spawn(move || {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            if download {
                install(&model, &shared, &cancel).map(|_| String::new())
            } else {
                record(&shared, &cancel, &stop)
                    .and_then(|audio| transcribe(&model, audio, &cancel, "pt"))
            }
        }))
        .unwrap_or_else(|_| Err("O mecanismo de voz falhou. Tente novamente.".into()));
        if let Ok(mut inner) = shared.lock() {
            inner.busy = false;
            inner.snapshot.model_ready = model.metadata().is_ok_and(|m| m.len() == MODEL_SIZE);
            if cancel.load(Ordering::SeqCst) {
                inner.snapshot.phase = "idle".into();
                inner.snapshot.text.clear();
            } else {
                match result {
                    Ok(text) => {
                        inner.snapshot.phase = if download { "idle" } else { "review" }.into();
                        inner.snapshot.text = text;
                    }
                    Err(error) => {
                        inner.snapshot.phase = "error".into();
                        inner.snapshot.error = Some(error);
                    }
                }
            }
        }
    });
    Ok(())
}
fn install(model: &PathBuf, shared: &Arc<Mutex<Inner>>, cancel: &AtomicBool) -> Result<(), String> {
    std::fs::create_dir_all(model.parent().ok_or("Pasta inválida")?).map_err(|e| e.to_string())?;
    let partial = model.with_extension("partial");
    let result = (|| {
        let client = reqwest::blocking::Client::builder()
            .https_only(true)
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(600))
            .build()
            .map_err(|e| e.to_string())?;
        let mut response = client
            .get(MODEL_URL)
            .send()
            .and_then(|r| r.error_for_status())
            .map_err(|_| {
                "Não foi possível baixar o modelo. Verifique a conexão e tente novamente."
            })?;
        let mut file = std::fs::File::create(&partial).map_err(|e| e.to_string())?;
        let mut hash = Sha256::new();
        let mut count = 0u64;
        let mut buffer = [0u8; 65536];
        loop {
            if cancel.load(Ordering::SeqCst) {
                return Err("Cancelado".into());
            }
            let n = response.read(&mut buffer).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            count += n as u64;
            if count > MODEL_SIZE {
                return Err("Modelo excede o tamanho esperado.".into());
            }
            hash.update(&buffer[..n]);
            file.write_all(&buffer[..n]).map_err(|e| e.to_string())?;
            if let Ok(mut s) = shared.lock() {
                s.snapshot.progress = (count * 100 / MODEL_SIZE) as u32;
            }
        }
        if count != MODEL_SIZE || format!("{:x}", hash.finalize()) != MODEL_HASH {
            return Err("Download incompleto ou inválido. Tente novamente.".into());
        }
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        std::fs::rename(&partial, model).map_err(|e| e.to_string())?;
        Ok(())
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(partial);
    }
    result
}
fn input<T: cpal::SizedSample + cpal::Sample>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    samples: Arc<Mutex<Vec<f32>>>,
    failure: Arc<Mutex<Option<String>>>,
) -> Result<cpal::Stream, String>
where
    f32: cpal::FromSample<T>,
{
    let channels = config.channels as usize;
    let limit = config.sample_rate.0 as usize * 60;
    device.build_input_stream(config, move |data: &[T], _| {
        if let Ok(mut out) = samples.lock() {
            for frame in data.chunks_exact(channels) {
                if out.len() >= limit { break; }
                out.push(frame.iter().map(|s| s.to_sample::<f32>()).sum::<f32>() / channels as f32);
            }
        }
    }, move |e| { if let Ok(mut f) = failure.lock() { *f = Some(e.to_string()); } }, None).map_err(|_| "Não foi possível abrir o microfone. Verifique a permissão de microfone para aplicativos desktop nas configurações do sistema.".into())
}
fn record(
    shared: &Arc<Mutex<Inner>>,
    cancel: &AtomicBool,
    stop: &AtomicBool,
) -> Result<Vec<f32>, String> {
    let device = cpal::default_host()
        .default_input_device()
        .ok_or("Nenhum microfone encontrado. Conecte um dispositivo e tente novamente.")?;
    let supported = device.default_input_config().map_err(|e| e.to_string())?;
    let config: cpal::StreamConfig = supported.clone().into();
    let samples = Arc::new(Mutex::new(Vec::with_capacity(
        config.sample_rate.0 as usize * 60,
    )));
    let failure = Arc::new(Mutex::new(None));
    let stream = match supported.sample_format() {
        cpal::SampleFormat::F32 => input::<f32>(&device, &config, samples.clone(), failure.clone()),
        cpal::SampleFormat::I16 => input::<i16>(&device, &config, samples.clone(), failure.clone()),
        cpal::SampleFormat::U16 => input::<u16>(&device, &config, samples.clone(), failure.clone()),
        _ => Err(
            "Formato do microfone não suportado. Selecione outro dispositivo padrão no sistema."
                .into(),
        ),
    }?;
    if cancel.load(Ordering::SeqCst) {
        return Err("Cancelado".into());
    }
    stream.play().map_err(|e| e.to_string())?;
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(60)
        && !stop.load(Ordering::SeqCst)
        && !cancel.load(Ordering::SeqCst)
    {
        if let Some(error) = failure.lock().map_err(|_| "Falha de áudio")?.clone() {
            return Err(format!("Microfone desconectado ou indisponível: {error}"));
        }
        if let Ok(mut s) = shared.lock() {
            s.snapshot.phase = "recording".into();
            s.snapshot.seconds = start.elapsed().as_secs();
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    drop(stream);
    if cancel.load(Ordering::SeqCst) {
        return Err("Cancelado".into());
    }
    if let Ok(mut s) = shared.lock() {
        s.snapshot.phase = "transcribing".into();
    }
    let audio = samples.lock().map_err(|_| "Falha de áudio")?;
    let audio = resample(&audio, config.sample_rate.0);
    validate_audio(&audio)?;
    Ok(audio)
}
fn resample(audio: &[f32], rate: u32) -> Vec<f32> {
    if rate == 0 || audio.is_empty() {
        return vec![];
    }
    // Windowed-sinc low-pass interpolation prevents aliasing when downsampling.
    let ratio = rate as f64 / 16000.0;
    let cutoff = (16000.0 / rate as f64).min(1.0) * 0.9;
    (0..(audio.len() as f64 / ratio) as usize)
        .map(|i| {
            let pos = i as f64 * ratio;
            let center = pos.floor() as isize;
            let mut sum = 0.0;
            let mut weight = 0.0;
            for j in center - 32..=center + 32 {
                if j < 0 || j >= audio.len() as isize {
                    continue;
                }
                let x = pos - j as f64;
                let z = std::f64::consts::PI * x * cutoff;
                let sinc = if z.abs() < 1e-9 { 1.0 } else { z.sin() / z };
                let w = sinc * (0.5 + 0.5 * (std::f64::consts::PI * x / 33.0).cos());
                sum += audio[j as usize] as f64 * w;
                weight += w;
            }
            (sum / weight) as f32
        })
        .collect()
}
fn validate_audio(audio: &[f32]) -> Result<(), String> {
    if audio.len() < 8000 {
        return Err("Gravação muito curta. Fale por pelo menos um segundo.".into());
    }
    let rms = (audio.iter().map(|x| x * x).sum::<f32>() / audio.len() as f32).sqrt();
    if !rms.is_finite() || rms < 0.001 {
        return Err(
            "Não foi detectado áudio suficiente. Aproxime-se do microfone e tente novamente."
                .into(),
        );
    }
    Ok(())
}
fn transcribe(
    model: &PathBuf,
    audio: Vec<f32>,
    cancel: &Arc<AtomicBool>,
    language: &str,
) -> Result<String, String> {
    // With no logging backend enabled these hooks discard native logs, including
    // decoder tokens in debug builds. Transcripts must never reach terminal logs.
    whisper_rs::install_logging_hooks();
    if cancel.load(Ordering::SeqCst) {
        return Err("Cancelado".into());
    }
    let mut config = WhisperContextParameters::default();
    config.use_gpu(false);
    let context = WhisperContext::new_with_params(
        model.to_str().ok_or("Caminho do modelo inválido")?,
        config,
    )
    .map_err(|_| "Não foi possível carregar o modelo. Reinstale o modelo de voz.")?;
    let mut state = context.create_state().map_err(|e| e.to_string())?;
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some(language));
    params.set_translate(false);
    params.set_n_threads(
        std::thread::available_parallelism()
            .map(|n| n.get().min(4))
            .unwrap_or(2) as i32,
    );
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_print_special(false);
    unsafe extern "C" fn abort(data: *mut std::ffi::c_void) -> bool {
        // The Arc in transcribe outlives the synchronous full() call.
        unsafe { (&*(data as *const AtomicBool)).load(Ordering::SeqCst) }
    }
    unsafe {
        params.set_abort_callback(Some(abort));
        params.set_abort_callback_user_data(Arc::as_ptr(cancel) as *mut std::ffi::c_void);
    }
    state
        .full(params, &audio)
        .map_err(|_| "Não foi possível transcrever. Tente gravar novamente.")?;
    let text = state
        .as_iter()
        .map(|s| {
            s.to_str_lossy()
                .map(|s| s.into_owned())
                .map_err(|e| e.to_string())
        })
        .collect::<Result<Vec<_>, _>>()?
        .join("")
        .trim()
        .to_string();
    if text.is_empty() {
        return Err("Não foi reconhecida uma frase. Tente novamente.".into());
    }
    Ok(text)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "Downloads the 142 MiB model; requires CHRONO_VOICE_FIXTURE_DIR with speech.wav"]
    fn offline_whisper_fixture() {
        let folder = PathBuf::from(
            std::env::var("CHRONO_VOICE_FIXTURE_DIR").expect("Set isolated fixture directory"),
        );
        let voice = VoiceState::new(folder.clone());
        if !voice.model.exists() {
            install(&voice.model, &voice.inner, &voice.cancel).unwrap();
        }
        let reader = hound::WavReader::open(folder.join("speech.wav")).unwrap();
        let spec = reader.spec();
        assert_eq!(spec.channels, 1);
        assert_eq!(spec.bits_per_sample, 16);
        let samples = reader
            .into_samples::<i16>()
            .map(|s| s.unwrap() as f32 / 32768.0)
            .collect::<Vec<_>>();
        let audio = resample(&samples, spec.sample_rate);
        validate_audio(&audio).unwrap();
        let text = transcribe(&voice.model, audio, &voice.cancel, "en").unwrap();
        assert!(
            text.to_lowercase().contains("country"),
            "Unexpected transcript: {text}"
        );
        voice.cancel.store(true, Ordering::SeqCst);
        assert!(transcribe(&voice.model, vec![0.1; 16000], &voice.cancel, "en").is_err());
    }
    #[test]
    fn silence_and_short_audio_are_rejected() {
        assert!(validate_audio(&vec![0.0; 16000]).is_err());
        assert!(validate_audio(&vec![0.2; 4000]).is_err());
        assert!(validate_audio(&vec![0.2; 16000]).is_ok());
    }
    #[test]
    fn resampling_preserves_duration_and_signal() {
        let input: Vec<f32> = (0..48000)
            .map(|i| (i as f32 * 440.0 * std::f32::consts::TAU / 48000.0).sin())
            .collect();
        let output = resample(&input, 48000);
        assert_eq!(output.len(), 16000);
        let error: f32 = output
            .iter()
            .enumerate()
            .skip(20)
            .take(15960)
            .map(|(i, x)| (x - (i as f32 * 440.0 * std::f32::consts::TAU / 16000.0).sin()).abs())
            .sum::<f32>()
            / 15960.0;
        assert!(error < 0.01, "{error}");
    }
}
