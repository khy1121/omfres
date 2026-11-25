import "./setup";
import { afterEach } from "node:test";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { Professor } from "../src/lib/config";

export const professor: Professor = {
  id: "test", name: "테스트 교수님", slotMinutes: 30,
  availability: [{ days: [0, 1, 2, 3, 4, 5, 6], start: "09:00", end: "17:00" }],
};
export const reservation = { id: "r1", professorId: "test", name: "테스트", date: "2099-09-24", time: "09:00", createdAt: "2099-09-01T00:00:00Z" };
export const slots = { slots: [{ time: "09:00", available: true }, { time: "10:00", available: true }] };
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

export async function chooseTime() {
  fireEvent.click(screen.getByRole("button", { name: "24" }));
  fireEvent.click(await screen.findByRole("button", { name: "10:00" }));
}
