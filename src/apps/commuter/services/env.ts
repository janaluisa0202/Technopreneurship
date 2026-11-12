// The only module that reads Vite's import.meta.env for data configuration.
import { readRuntimeConfig, type RuntimeConfig } from './runtimeConfig';

export const runtimeConfig: RuntimeConfig = readRuntimeConfig(import.meta.env as unknown as Record<string, string | boolean | undefined>);
