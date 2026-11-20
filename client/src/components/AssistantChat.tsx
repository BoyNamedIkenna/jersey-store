import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Jersey } from "@/components/Jersey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ApiError,
  streamAssistant,
  type AssistantFilters,
  type AssistantMessage,
  type AssistantProduct,
} from "@/lib/api";
import { formatNaira } from "@/lib/format";

const SUGGESTIONS = [
  "An Arsenal home kit under ₦70,000",
  "A red basketball jersey",
  "Football jerseys in size XXL",
  "Show me the Nigeria jerseys",
];

// The server accepts 12 messages per request, counting the new one.
const MAX_MESSAGES = 12;

interface Turn {
  role: "user" | "assistant";
  content: string;
  products?: AssistantProduct[] | undefined;
  filters?: AssistantFilters | null | undefined;
  pending?: boolean | undefined;
  status?: string | undefined;
}

function describeFilters(f: AssistantFilters): string {
  const parts: string[] = [];
  if (f.teams.length > 0) parts.push(f.teams.join(" or "));
  else if (f.league) parts.push(f.league);
  else if (f.sport) parts.push(f.sport);
  if (f.color) parts.push(f.color);
  if (f.kit) parts.push(`${f.kit} kit`);
  if (f.size) parts.push(`size ${f.size}`);
  if (f.minPriceNaira) parts.push(`from ${formatNaira(f.minPriceNaira * 100)}`);
  if (f.maxPriceNaira) parts.push(`up to ${formatNaira(f.maxPriceNaira * 100)}`); if (f.query) parts.push(`"${f.query}"`);
  return parts.join(" · ");
}

function toMessages(turns: Turn[]): AssistantMessage[] {
  return turns.slice(-MAX_MESSAGES).map(({ role, content }) => ({ role, content }));
}

function ProductRow({ product, onNavigate }: { product: AssistantProduct; onNavigate: () => void }) {
  return (
    <li>
      <Link
        to={`/products/${product.slug}`}
        onClick={onNavigate}
        className="flex gap-3 rounded-lg border p-2 hover:bg-muted/50"
      >
        <div className="w-16 shrink-0 self-start rounded-md bg-muted p-1.5">
          <Jersey
            sport={product.sport}
            primary={product.primaryColor}
            secondary={product.secondaryColor}
            accent={product.accentColor}
            pattern={product.pattern}
            title={product.name}
            className="w-full"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-snug">{product.name}</div>
          <div className="text-xs text-muted-foreground">
            {product.league.name} · Sizes {product.sizesInStock.join(", ")}
          </div>
          <div className="text-sm font-semibold">{formatNaira(product.priceKobo)}</div>
        </div>
      </Link>
    </li>
  );
}

function MessageBubble({ turn, onNavigate }: { turn: Turn; onNavigate: () => void }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          {turn.content}
        </div>
      </div>
    );
  }

  const searched = turn.filters ? describeFilters(turn.filters) : "";
  const waiting = turn.pending && !turn.content;

  return (
    <div className="space-y-2">
      <div className={`max-w-[90%] rounded-lg bg-muted px-3 py-2 text-sm ${waiting ? "animate-pulse text-muted-foreground" : ""}`}>
        {waiting ? (turn.status ?? "Thinking…") : turn.content}
      </div>
      {searched && <p className="text-xs text-muted-foreground">Searched: {searched}</p>}
      {turn.products && turn.products.length > 0 && (
        <ul className="space-y-2">
          {turn.products.map((p) => (
            <ProductRow key={p.id} product={p} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Leaving the page cancels any reply still being written.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, error]);

  // `history` ends with the shopper's message. The assistant's reply is added as a pending turn and filled in as it streams.
  async function run(history: Turn[]) {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setTurns([...history, { role: "assistant", content: "", pending: true, status: "Thinking…" }]);

    const patchLast = (patch: (turn: Turn) => Turn) =>
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? patch(turn) : turn)));

    let finished = false;
    let streamError: string | null = null;

    try {
      await streamAssistant(
        toMessages(history),
        (event) => {
          switch (event.type) {
            case "status":
              patchLast((t) => (t.content ? t : { ...t, status: event.text }));
              break;
            case "products":
              patchLast((t) => ({ ...t, products: event.products, filters: event.filters }));
              break;
            case "delta":
              patchLast((t) => ({ ...t, content: t.content + event.text, status: undefined }));
              break;
            case "reset":
              patchLast((t) => ({ ...t, content: "" }));
              break;
            case "done":
              finished = true;
              patchLast(() => ({
                role: "assistant",
                content: event.reply,
                products: event.products,
                filters: event.filters,
              }));
              break;
            case "error":
              finished = true;
              streamError = event.message;
              break;
          }
        },
        controller.signal,
      );

      if (streamError) throw new ApiError(502, streamError);
      if (!finished) throw new Error("The connection was interrupted");
    } catch (err) {
      if (controller.signal.aborted) return;
      setTurns(history); // drop the unfinished reply so Retry can resend the same message
      setError(err instanceof ApiError ? err.message : "The connection was interrupted. Please try again.");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  }

  function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setDraft("");
    void run([...turns, { role: "user", content }]);
  }

  function retry() {
    if (!busy) void run(turns);
  }

  function startOver() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setTurns([]);
    setError(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(draft);
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="fixed bottom-4 right-4 z-40 rounded-full shadow-lg"
      >
        Ask the assistant
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b p-4">
            <SheetTitle>Jersey assistant</SheetTitle>
            <SheetDescription>
              Tell me what you are after. Answers come from this store's catalogue.
            </SheetDescription>
          </SheetHeader>

          <div role="log" aria-live="polite" aria-busy={busy} className="flex-1 space-y-4 overflow-y-auto p-4">
            {turns.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Try one of these:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((turn, i) => (
              <MessageBubble key={i} turn={turn} onNavigate={() => setOpen(false)} />
            ))}

            {error && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/40 p-3">
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
                <Button variant="outline" size="sm" onClick={retry} disabled={busy}>
                  Retry
                </Button>
              </div>
            )}

            <div ref={endRef} />
          </div>

          <div className="border-t p-3">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={500}
                aria-label="Message to the assistant"
                placeholder="For example: a green home kit in size M"
                disabled={busy}
              />
              <Button type="submit" disabled={busy || draft.trim() === ""}>
                Send
              </Button>
            </form>
            {turns.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-auto p-0 text-xs text-muted-foreground"
                onClick={startOver}
              >
                Start over
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}