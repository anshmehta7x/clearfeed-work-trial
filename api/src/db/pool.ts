import { Pool, type PoolConfig } from "pg";

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 5432;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getPoolConfig(): PoolConfig {
  return {
    host: process.env["POSTGRES_HOST"] || DEFAULT_HOST,
    port: Number(process.env["POSTGRES_PORT"]) || DEFAULT_PORT,
    user: requiredEnv("POSTGRES_USER"),
    password: requiredEnv("POSTGRES_PASSWORD"),
    database: requiredEnv("POSTGRES_DB"),
  };
}

export function createPool(): Pool {
  return new Pool(getPoolConfig());
}
