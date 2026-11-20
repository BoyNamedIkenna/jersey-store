import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { runAssistant } from "../lib/assistant";
import { AppError, asyncHandler } from "../middleware/error";

export const assistantRouter = Router();

// A public endpoint that calls a paid model needs limits. This is per visitor.
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "You are sending messages quickly. Please wait a few minutes and try again." },
});

// And this is a global daily ceiling. It resets when the server restarts, so also set a monthly
// spending limit in the OpenAI dashboard: that is the real safety net.
const DAILY_LIMIT = Number(process.env.ASSISTANT_DAILY_LIMIT) || 300;
let budgetDay = new Date().toISOString().slice(0, 10);
let budgetUsed = 0;

function withinBudget() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    budgetUsed = 0;
  }
  if (budgetUsed >= DAILY_LIMIT) return false;
  budgetUsed++;
  return true;
}

const bodySchema = z
  .object({
    messages: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
      .min(1)
      .max(12),
  })
  .refine((b) => b.messages[b.messages.length - 1]?.role === "user", {
    message: "The last message must be from the user",
  })
  .refine((b) => (b.messages[b.messages.length - 1]?.content.length ?? 0) <= 500, {
    message: "Message too long",
  });

// Validation and limits run before anything is sent, so these failures are ordinary JSON errors.
function checkRequest(body: unknown) {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, "Invalid message");
  if (!withinBudget()) {
    throw new AppError(503, "The assistant has reached its daily limit. Please try again tomorrow.");
  }
  return parsed.data.messages;
}

// Plain JSON answer: used by tests and the eval script.
assistantRouter.post(
  "/",
  limiter,
  asyncHandler(async (req, res) => {
    const messages = checkRequest(req.body);
    try {
      res.json(await runAssistant(messages));
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error("Assistant failed:", err);
      throw new AppError(502, "The assistant is unavailable right now. Please try again.");
    }
  }),
);

// Streamed answer, as server-sent events: one "data: {json}" line per event.
assistantRouter.post(
  "/stream",
  limiter,
  asyncHandler(async (req, res) => {
    const messages = checkRequest(req.body);

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // tells proxies not to buffer the stream
    });
    res.flushHeaders();

    // If the shopper closes the tab, stop the model call so we stop paying for it.
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });

    const send = (event: object) => {
      if (!res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const result = await runAssistant(messages, { onEvent: send, signal: controller.signal });
      // The final event carries the complete answer, so the client can settle on exactly what the server decided.
      send({ type: "done", reply: result.reply, products: result.products, filters: result.filters });
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error("Assistant failed:", err);
        send({
          type: "error",
          message: err instanceof AppError ? err.message : "The assistant is unavailable right now. Please try again.",
        });
      }
    } finally {
      res.end();
    }
  }),
);