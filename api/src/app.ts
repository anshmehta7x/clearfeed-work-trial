import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(routes);
app.use(notFound);
app.use(errorHandler);

export default app;
