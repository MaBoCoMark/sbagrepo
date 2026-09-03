// Global ambient declarations for React, Primer React, and Tauri APIs

declare namespace JSX {
  interface Element extends Record<string, any> {}
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare namespace React {
  export type ReactNode = any;
  export type ElementType = any;
  export type FC<P = {}> = (props: P) => any;
  export type ComponentType<P = {}> = any;
  export type RefObject<T> = { current: T };
  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prevState: S) => S);
  export type HTMLAttributes<T> = Record<string, any>;
  export type ButtonHTMLAttributes<T> = Record<string, any>;
  export type InputHTMLAttributes<T> = Record<string, any>;
  export type SelectHTMLAttributes<T> = Record<string, any>;
  export type OptionHTMLAttributes<T> = Record<string, any>;
  export type AnchorHTMLAttributes<T> = Record<string, any>;
  export type SVGProps<T> = Record<string, any>;
  export type SVGAttributes<T> = Record<string, any>;
  export type RefAttributes<T> = Record<string, any>;
  export type ForwardRefExoticComponent<P> = any;
  export type MouseEvent<T = Element> = any;
  export type ChangeEvent<T = Element> = any;

  export function useState<T>(initialState: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function useRef<T>(initialValue: T): RefObject<T>;
  export function useRef<T = undefined>(): RefObject<T | undefined>;

  export const StrictMode: FC<{ children?: ReactNode }>;
  export const Fragment: FC<{ children?: ReactNode }>;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module 'react' {
  export = React;
}

declare module 'react-dom/client' {
  export interface Root {
    render(children: any): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}

declare module '@tauri-apps/api/core' {
  export function invoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T>;
}

declare module '@tauri-apps/api/event' {
  export interface Event<T> {
    event: string;
    id: number;
    payload: T;
  }
  export type UnlistenFn = () => void;
  export function listen<T = any>(event: string, handler: (event: Event<T>) => void): Promise<UnlistenFn>;
  export function once<T = any>(event: string, handler: (event: Event<T>) => void): Promise<UnlistenFn>;
  export function emit<T = any>(event: string, payload?: T): Promise<void>;
}

// Modern Primer React v38+ definitions (Strictly no Box, no Flash, no sx prop)
declare module '@primer/react' {
  export interface ThemeProviderProps {
    children?: React.ReactNode;
    colorMode?: 'auto' | 'day' | 'night' | 'light' | 'dark';
  }
  export const ThemeProvider: React.FC<ThemeProviderProps>;

  export interface BaseStylesProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
  }
  export const BaseStyles: React.FC<BaseStylesProps>;

  export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
    as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    children?: React.ReactNode;
  }
  export const Heading: React.FC<HeadingProps>;

  export interface TextProps extends React.HTMLAttributes<HTMLElement> {
    as?: React.ElementType;
    children?: React.ReactNode;
  }
  export const Text: React.FC<TextProps>;

  export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'primary' | 'danger' | 'invisible' | 'outline';
    size?: 'small' | 'medium' | 'large';
    leadingVisual?: React.ComponentType<any>;
    trailingVisual?: React.ComponentType<any>;
    loading?: boolean;
    disabled?: boolean;
    block?: boolean;
    children?: React.ReactNode;
  }
  export const Button: React.FC<ButtonProps>;

  export interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    leadingVisual?: React.ComponentType<any>;
    trailingVisual?: React.ComponentType<any>;
    block?: boolean;
    size?: 'small' | 'medium' | 'large';
    monospace?: boolean;
  }
  export const TextInput: React.ForwardRefExoticComponent<TextInputProps & React.RefAttributes<HTMLInputElement>>;

  export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: React.ReactNode;
    description?: React.ReactNode;
    variant?: 'info' | 'warning' | 'critical' | 'success';
    onDismiss?: () => void;
  }
  export const Banner: React.FC<BannerProps>;

  export interface LabelProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'primary' | 'secondary' | 'accent' | 'success' | 'attention' | 'severe' | 'danger' | 'done' | 'sponsors';
    size?: 'small' | 'large';
    children?: React.ReactNode;
  }
  export const Label: React.FC<LabelProps>;

  export interface CounterLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
    scheme?: 'primary' | 'secondary';
    children?: React.ReactNode;
  }
  export const CounterLabel: React.FC<CounterLabelProps>;

  export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
    size?: 'small' | 'medium' | 'large';
  }
  export const Spinner: React.FC<SpinnerProps>;

  export interface UnderlineNavProps extends React.HTMLAttributes<HTMLElement> {
    'aria-label': string;
    children?: React.ReactNode;
  }
  export interface UnderlineNavItemProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    'aria-current'?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false' | boolean;
    icon?: React.ComponentType<any>;
    onSelect?: (event: any) => void;
    children?: React.ReactNode;
  }
  export const UnderlineNav: React.FC<UnderlineNavProps> & {
    Item: React.FC<UnderlineNavItemProps>;
  };

  export interface FormControlProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
    disabled?: boolean;
    required?: boolean;
  }
  export interface FormControlLabelProps extends React.HTMLAttributes<HTMLLabelElement> {
    children?: React.ReactNode;
    htmlFor?: string;
    visuallyHidden?: boolean;
  }
  export interface FormControlCaptionProps extends React.HTMLAttributes<HTMLSpanElement> {
    children?: React.ReactNode;
  }
  export const FormControl: React.FC<FormControlProps> & {
    Label: React.FC<FormControlLabelProps>;
    Caption: React.FC<FormControlCaptionProps>;
  };

  export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
    size?: 'small' | 'medium' | 'large';
    block?: boolean;
    children?: React.ReactNode;
    value?: string | number;
    onChange?: (e: any) => void;
  }
  export interface SelectOptionProps extends React.OptionHTMLAttributes<HTMLOptionElement> {
    value: string | number;
    children?: React.ReactNode;
  }
  export const Select: React.FC<SelectProps> & {
    Option: React.FC<SelectOptionProps>;
  };
}

declare module '@primer/octicons-react' {
  export type Icon = React.FC<React.SVGProps<SVGSVGElement> & { size?: number | 'small' | 'medium' | 'large'; fill?: string }>;
  export const CheckIcon: Icon;
  export const PlayIcon: Icon;
  export const ShieldCheckIcon: Icon;
  export const ShieldLockIcon: Icon;
  export const StopIcon: Icon;
  export const TerminalIcon: Icon;
  export const GearIcon: Icon;
  export const SyncIcon: Icon;
  export const AlertIcon: Icon;
  export const CheckCircleIcon: Icon;
  export const XCircleIcon: Icon;
  export const InfoIcon: Icon;
  export const ServerIcon: Icon;
  export const FileCodeIcon: Icon;
  export const TrashIcon: Icon;
  export const CopyIcon: Icon;
  export const DownloadIcon: Icon;
  export const FilterIcon: Icon;
  export const KeyIcon: Icon;
  export const UploadIcon: Icon;
  export const LockIcon: Icon;
  export const ShieldIcon: Icon;
  export const CpuIcon: Icon;
}

declare module '*.css' {}
