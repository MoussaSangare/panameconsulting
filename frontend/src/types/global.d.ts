// Fichier de déclaration global pour les modules sans types

declare module 'react-helmet-async' {
  import { HelmetData } from 'react-helmet';
  import { ReactNode } from 'react';
  
  export interface HelmetProviderProps {
    context?: {};
    children: ReactNode;
  }
  
  export interface HelmetProps {
    children?: ReactNode;
    title?: string;
    titleTemplate?: string;
    defaultTitle?: string;
    onChangeClientState?: (newState: any) => void;
    htmlAttributes?: any;
    bodyAttributes?: any;
  }
  
  export class HelmetProvider extends React.Component<HelmetProviderProps> {}
  export class Helmet extends React.Component<HelmetProps> {}
  export function useHelmet(): HelmetData;
}

declare module 'react-toastify' {
  import { ReactNode } from 'react';
  
  export interface ToastOptions {
    position?: string;
    autoClose?: number;
    hideProgressBar?: boolean;
    closeOnClick?: boolean;
    pauseOnHover?: boolean;
    draggable?: boolean;
    progress?: undefined;
    theme?: string;
  }
  
  export const toast: {
    success: (message: string, options?: ToastOptions) => void;
    error: (message: string, options?: ToastOptions) => void;
    info: (message: string, options?: ToastOptions) => void;
    warning: (message: string, options?: ToastOptions) => void;
    (message: string, options?: ToastOptions): void;
  };
  
  export interface ToastContainerProps {
    position?: string;
    autoClose?: number;
    hideProgressBar?: boolean;
    newestOnTop?: boolean;
    closeOnClick?: boolean;
    rtl?: boolean;
    pauseOnFocusLoss?: boolean;
    draggable?: boolean;
    pauseOnHover?: boolean;
    theme?: string;
  }
  
  export const ToastContainer: React.ComponentType<ToastContainerProps>;
}

declare module 'aos' {
  export interface AosOptions {
    offset?: number;
    delay?: number;
    duration?: number;
    easing?: string;
    once?: boolean;
    mirror?: boolean;
    anchorPlacement?: string;
  }
  
  export function init(options?: AosOptions): void;
  export function refresh(): void;
  export function refreshHard(): void;
}

// Déclarations pour react-icons
declare module 'react-icons/fi' {
  import { IconType } from 'react-icons';
  export const FiCalendar: IconType;
  export const FiClock: IconType;
  export const FiMapPin: IconType;
  export const FiUser: IconType;
  export const FiMail: IconType;
  export const FiPhone: IconType;
  export const FiMessageSquare: IconType;
  export const FiChevronDown: IconType;
  export const FiChevronUp: IconType;
  export const FiX: IconType;
  export const FiCheck: IconType;
  export const FiAlertCircle: IconType;
  // Ajoutez d'autres icônes au besoin
  
}

declare module 'react-icons/fa' {
  import { IconType } from 'react-icons';
  export const FaWhatsapp: IconType;
  export const FaTelegram: IconType;
  export const FaUserGraduate: IconType;
  // Ajoutez d'autres icônes au besoin
}