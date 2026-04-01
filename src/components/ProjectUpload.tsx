import React, { useState, useCallback } from "react";
import { FileUp, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { parseBookingExcel, BookingRow } from "../services/salesService";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { toast } from "sonner";
import { useAuth } from "./FirebaseProvider";

interface ProjectUploadProps {
  projectId: string;
  onSuccess?: () => void;
}

export function ProjectUpload({ projectId, onSuccess }: ProjectUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<{ new: number; updated: number; rejected: number } | null>(null);

  const processFile = async (file: File) => {
    if (!user) return;
    setUploading(true);
    setStats(null);

    try {
      const buffer = await file.arrayBuffer();
      const rows = parseBookingExcel(buffer);
      
      let newCount = 0;
      let updatedCount = 0;
      let rejectedCount = 0;

      // Create an upload record
      const uploadRef = await addDoc(collection(db, "projects", projectId, "uploads"), {
        projectId,
        uploaderUid: user.uid,
        fileName: file.name,
        status: 'processing',
        createdAt: serverTimestamp()
      });

      for (const row of rows) {
        try {
          // Basic validation
          if (!row['Код'] || !row['Итого']) {
            rejectedCount++;
            continue;
          }

          // Check for existing booking with same code in this project
          const q = query(
            collection(db, "projects", projectId, "bookings"),
            where("code", "==", String(row['Код']))
          );
          const existing = await getDocs(q);

          const bookingData = {
            projectId,
            sellerUid: user.uid, // In a real app, map row['Seller'] to UID
            code: String(row['Код']),
            source: row['Источник'] || 'Unknown',
            bookingDate: row['Дата брони'] || null,
            cancelDate: row['Дата отмены'] === '-' ? null : row['Дата отмены'],
            checkIn: row['Заезд'] || null,
            checkOut: row['Выезд'] || null,
            category: row['Категория'] || 'Unknown',
            roomNumber: String(row['Номер'] || ''),
            total: Number(row['Итого']),
            status: (row['Дата отмены'] && row['Дата отмены'] !== '-') ? 'cancelled' : 'active',
            updatedAt: serverTimestamp()
          };

          if (!existing.empty) {
            await updateDoc(doc(db, "projects", projectId, "bookings", existing.docs[0].id), bookingData);
            updatedCount++;
          } else {
            await addDoc(collection(db, "projects", projectId, "bookings"), {
              ...bookingData,
              createdAt: serverTimestamp()
            });
            newCount++;
          }
        } catch (e) {
          console.error("Row processing error:", e);
          rejectedCount++;
        }
      }

      // Update upload record with stats
      await updateDoc(uploadRef, {
        status: 'success',
        stats: { new: newCount, updated: updatedCount, rejected: rejectedCount }
      });

      setStats({ new: newCount, updated: updatedCount, rejected: rejectedCount });
      toast.success("Отчет успешно обработан");
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Ошибка при загрузке файла");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      processFile(file);
    } else {
      toast.error("Пожалуйста, выберите файл Excel (.xlsx)");
    }
  }, []);

  return (
    <div className="space-y-6">
      <div 
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-3xl p-12 text-center space-y-4 transition-all ${
          uploading ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
        }`}
      >
        {uploading ? (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto" />
            <div>
              <p className="text-white font-bold">Обработка отчета...</p>
              <p className="text-slate-500 text-sm">Это может занять несколько секунд</p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto">
              <FileUp className="w-8 h-8 text-slate-500" />
            </div>
            <div>
              <p className="text-white font-bold">Перетащите XLSX отчет сюда</p>
              <p className="text-slate-500 text-sm">Или нажмите, чтобы выбрать файл</p>
            </div>
            <input 
              type="file" 
              accept=".xlsx,.xls"
              onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
              className="hidden" 
              id="file-upload"
            />
            <label 
              htmlFor="file-upload"
              className="inline-block bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
            >
              Выбрать файл
            </label>
          </>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
            <div className="text-emerald-500 font-black text-2xl">{stats.new}</div>
            <div className="text-[10px] text-emerald-500/70 uppercase font-bold">Новых</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-center">
            <div className="text-blue-500 font-black text-2xl">{stats.updated}</div>
            <div className="text-[10px] text-blue-500/70 uppercase font-bold">Обновлено</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
            <div className="text-red-500 font-black text-2xl">{stats.rejected}</div>
            <div className="text-[10px] text-red-500/70 uppercase font-bold">Ошибок</div>
          </div>
        </div>
      )}
    </div>
  );
}
