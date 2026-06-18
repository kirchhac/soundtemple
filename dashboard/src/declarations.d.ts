declare module 'react-plotly.js' {
  import { Component } from 'react';
  import Plotly from 'plotly.js';

  interface PlotParams {
    data: Plotly.Data[];
    layout?: Partial<Plotly.Layout>;
    config?: Partial<Plotly.Config>;
    style?: React.CSSProperties;
    className?: string;
    onClick?: (event: Plotly.PlotMouseEvent) => void;
    onHover?: (event: Plotly.PlotHoverEvent) => void;
  }

  class Plot extends Component<PlotParams> {}
  export default Plot;
}

declare module 'three/examples/jsm/loaders/OBJLoader' {
  import { Loader, Group } from 'three';
  export class OBJLoader extends Loader {
    load(
      url: string,
      onLoad?: (group: Group) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: ErrorEvent) => void,
    ): void;
    parse(data: string): Group;
  }
}
