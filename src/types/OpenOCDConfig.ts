
export interface OpenOCDConfigurationInterface {
  interface: string;
  targetMCU: string;
}

/**
 * Data model for the OpenOCD debugger and programmer configuration.
 * It supplies the implementation used by this part of the extension.
 */
import { standardOpenOCDInterface } from '../Definitions';

export class OpenOCDConfiguration implements OpenOCDConfigurationInterface {
  public targetMCU: string;
  public interface: string;
  public constructor(targetMCU: string) {
    this.targetMCU = targetMCU;
    this.interface = standardOpenOCDInterface;
  }
}