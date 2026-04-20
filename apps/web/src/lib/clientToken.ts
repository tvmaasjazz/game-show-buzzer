import { v4 as uuidv4 } from "uuid";
import { storage } from "./storage";

export const getClientToken = (): string => {
  const existing = storage.clientToken.get();
  if (existing) return existing;
  const fresh = uuidv4();
  storage.clientToken.set(fresh);
  return fresh;
};
