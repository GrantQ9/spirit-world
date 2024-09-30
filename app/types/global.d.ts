
interface IElectronAPI {
  loadPreferences: () => Promise<void>,
}

interface Window {
  version: string
  electronAPI: IElectronAPI
}

type Collection<T> = {[key:string]: T} | Array<T>;

type Color = string;
type Range = [number, number];

type Tags = {[key: string]: true};

interface Renderable {
    render(context: CanvasRenderingContext2D, target: Rect): void
}
