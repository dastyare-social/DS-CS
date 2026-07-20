declare module 'ffmpeg-probe' {
  export interface ProbeStream {
    index: number;
    codec_name: string;
    codec_type: string;
    width?: number;
    height?: number;
    duration?: number;
    [key: string]: any;
  }

  export interface ProbeFormat {
    duration?: number;
    size?: string;
    bit_rate?: string;
    [key: string]: any;
  }

  export interface ProbeResult {
    streams: ProbeStream[];
    format: ProbeFormat;
    width?: number;
    height?: number;
    duration?: number;
    fps?: number;
    [key: string]: any;
  }

  function probe(filePath: string): Promise<ProbeResult>;
  
  export default probe;
}
