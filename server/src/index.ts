import "dotenv/config"; // must stay first so env vars exist before other modules read them
import express from "express";
import cors from "cors";
import { productsRouter } from "./routes/products";
import { leaguesRouter } from "./routes/leagues";
import { errorHandler, notFound } from "./middleware/error";
import { cartRouter } from "./routes/cart"
import { meRouter } from "./routes/me"

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL ?? "*" }));

// Later: the Paystack webhook route must be mounted BEFORE this line with express.raw(),
// because signature checking needs the untouched request body.
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/products", productsRouter);
app.use("/leagues", leaguesRouter);
app.use("/cart", cartRouter);
app.use("/me", meRouter);

// Order matters: these two must come after every route.
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`API listening on ${port}`));