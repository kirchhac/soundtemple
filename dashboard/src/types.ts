export interface SpectralPeak {
  freq_hz: number;
  magnitude: number;
  note: string;
  cents: number;
  ratio_to_fundamental?: number;
}

export interface ManifestFile {
  id: string;
  filename: string;
  site: string;
  city: string;
  country: string;
  labeled_note: string | null;
  dominant_freq_hz: number;
  dominant_note: string;
  dominant_cents: number;
  freq_std_hz: number;
  freq_stability: 'very_stable' | 'stable' | 'moderate' | 'variable';
  duration_s: number;
  strongest_time_s: number;
  strongest_freq_hz: number;
  strongest_magnitude: number;
  spectral_peaks: SpectralPeak[];
  resonant_freqs_hz?: number[];
  has_sustained_resonation?: boolean;
  time_series_mini: { times: number[]; freqs: number[]; rms_levels?: number[] };
}

export interface Manifest {
  total_files: number;
  analyzed: number;
  errors: number;
  files: ManifestFile[];
  error_list: { file: string; error: string }[];
}

export interface FileDetail extends ManifestFile {
  time_series: {
    times: number[];
    dominant_freqs: number[];
    rms_levels: number[];
    peak_magnitudes: number[];
    top3_per_segment: { freq: number; mag: number }[][];
  };
  spectrogram: {
    freq_axis: number[];
    time_axis: number[];
    data: number[][];
  };
  avg_spectrum: {
    freqs: number[];
    magnitudes: number[];
  };
}

export interface VideoAnalysis extends FileDetail {
  video_filename: string;
}

export interface VideoManifest {
  videos: VideoManifestEntry[];
}

export interface VideoManifestEntry {
  id: string;
  video_filename: string;
  site: string;
  city: string;
  country?: string;
  dominant_freq_hz: number;
  dominant_note: string;
  duration_s: number;
  resonant_freqs_hz?: number[];
  has_sustained_resonation?: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  objPath: string;
  mtlPath: string;
  texturePath?: string;
  dimensions: { width: string; height: string; depth: string };
  resonance?: string;
  sites: string[];
}
