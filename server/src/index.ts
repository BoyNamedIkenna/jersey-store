import "dotenv/config"; // must stay first so env vars exist before other modules read them
import express from "express";
import cors from "cors";
import { productsRouter } from "./routes/products";
import { leaguesRouter } from "./routes/leagues";
import { errorHandler, notFound } from "./middleware/error";
import { cartRouter } from "./routes/cart"
import { meRouter } from "./routes/me"
import { ordersRouter } from "./routes/orders";
import { paymentsRouter } from "./routes/payments";
import { webhooksRouter } from "./routes/webhooks";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL ?? "*" }));

app.use("/webhooks", webhooksRouter);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/products", productsRouter);
app.use("/leagues", leaguesRouter);
app.use("/cart", cartRouter);
app.use("/me", meRouter);
app.use("/orders", ordersRouter);
app.use("/payments", paymentsRouter);

// Order matters: these two must come after every route.
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`API listening on ${port}`));