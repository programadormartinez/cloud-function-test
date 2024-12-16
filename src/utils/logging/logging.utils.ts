import { debug, info, warn, write } from 'firebase-functions/logger';
import * as uuid from 'uuid';

export interface LoggerOptions {
  defaultMeta?: { [key: string]: any };
}

export class Logger {
  /* ------ STATIC VARIABLES AND FUNCTIONS ------ */
  public static debug(message: string, data?: any) {
    debug(message, { data });
  }
  public static error(message: string, data: any, severity: 'ALERT' | 'CRITICAL' | 'EMERGENCY' | 'ERROR' = 'ERROR'): void {
    write({
      data,
      message,
      severity
    });
  }
  public static info(message: string, data?: any): void {
    info(message, { data });
  }
  public static warn(message: string, data?: any): void {
    warn(message, { data });
  }
  /* ------ END OF STATIC VARIABLES AND FUNCTIONS ------ */
  public currentStep: {
    initTime: number;
    label: string;
  };
  private _initTime: number;
  private _metadata: any;
  constructor(options?: LoggerOptions) {
    this._initTime = new Date().getTime();
    this.currentStep = {
      initTime: this._initTime,
      label: ''
    };
    this._metadata = { ...(options && options.defaultMeta), loggerId: uuid.v4() };
  }

  public changeStep(label: string) {
    const now = new Date().getTime();
    const elapsedTimeFromPreviousStep = now - this.currentStep.initTime;
    if (this.currentStep.label) {
      this.debug(`step ${this.currentStep.label} took ${elapsedTimeFromPreviousStep} ms`, {
        eventName: 'step-end',
        step: this.currentStep.label,
        elapsedTimeFromPreviousStep,
        totalElapsedTime: now - this._initTime
      });
    }
    this.currentStep.initTime = now;
    this.currentStep.label = label;
    this.debug(`step ${this.currentStep.label} start`, {
      eventName: 'step-start',
      step: this.currentStep.label
    });
  }

  public clear(): void { // we keep in case in the future we use a logger that needs to drain memory
  }

  public debug(message: string, data?: any): void {
    debug(message, {
      data,
      metadata: this._metadata
    });
  }

  public error(message: string, data: any, severity: 'ALERT' | 'CRITICAL' | 'EMERGENCY' | 'ERROR' = 'ERROR'): void {
    write({
      data,
      message,
      metadata: this._metadata,
      severity
    });
  }

  public info(message: string, data?: any): void {
    info(message, {
      data,
      metadata: this._metadata
    });
  }

  public warn(message: string, data?: any): void {
    warn(message, {
      data,
      metadata: this._metadata
    });
  }
}

export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}
