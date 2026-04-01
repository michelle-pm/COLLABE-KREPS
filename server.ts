import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import * as XLSX from "xlsx";
import cors from "cors";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  const upload = multer({ dest: "uploads/" });

  // API Routes
  app.post("/api/parse-bookings", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = "Бронирования";
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Sheet 'Бронирования' not found" });
      }

      const data = XLSX.utils.sheet_to_json(worksheet);
      
      // Mapping logic according to spec
      const bookings = data.map((row: any) => {
        const bookingDate = row["Дата брони"];
        const checkinDate = row["Заезд"];
        const checkoutDate = row["Выезд"];
        const cancellationDate = row["Дата отмены"];

        // Simple date parsing for dd.mm.yyyy or similar
        const parseDate = (d: any) => {
          if (!d || d === "-") return null;
          // If it's a number (Excel serial date)
          if (typeof d === 'number') {
            return new Date(Math.round((d - 25569) * 86400 * 1000)).toISOString();
          }
          return new Date(d).toISOString();
        };

        const checkinIso = parseDate(checkinDate);
        const monthKey = checkinIso ? checkinIso.substring(0, 7) : null;

        return {
          booking_code: String(row["Код"] || ""),
          source: String(row["Источник"] || ""),
          raw_group: String(row["Группа"] || ""),
          booking_date: parseDate(bookingDate),
          cancellation_date: parseDate(cancellationDate),
          checkin_datetime: checkinIso,
          checkout_datetime: parseDate(checkoutDate),
          category: String(row["Категория"] || ""),
          room: String(row["Номер"] || ""),
          total_amount: Number(row["Итого"] || 0),
          monthKey
        };
      }).filter(b => b.booking_code && b.checkin_datetime);

      fs.unlinkSync(req.file.path);
      res.json({ bookings });
    } catch (error) {
      console.error("Error parsing Excel:", error);
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: "Failed to parse Excel file" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
