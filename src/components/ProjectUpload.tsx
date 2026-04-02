import React, { useState, useCallback } from "react";
import { FileUp, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { parseBookingExcel, BookingRow } from "../services/salesService";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { toast } from "sonner";
import { useAuth } from "./FirebaseProvider";
import { toIsoOrNull, monthKey, processDate } from "../lib/date";

import { logAction } from "../services/auditService";

interface ProjectUploadProps {
  projectId: string;
  actorRole: string;
  onSuccess?: () => void;
}

export function ProjectUpload({ projectId, actorRole, onSuccess }: ProjectUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<{ new: number; updated: number; rejected: number } | null>(null);

  const processFile = async (file: File, type: 'sellers_report' | 'full_bookings_report') => {
    if (!user) return;
    setUploading(true);
    setStats(null);

    try {
      await logAction({
        action: 'import_start',
        actor_uid: user.uid,
        actor_role: actorRole,
        project_id: projectId,
        after_json: { fileName: file.name, type }
      });

      const buffer = await file.arrayBuffer();
      const rows = parseBookingExcel(buffer);
      
      let newCount = 0;
      let updatedCount = 0;
      let rejectedCount = 0;

      // Create an upload record
      const uploadPath = `projects/${projectId}/uploads`;
      const uploadRef = await addDoc(collection(db, uploadPath), {
        projectId,
        uploaderUid: user.uid,
        fileName: file.name,
        sourceFileType: type,
        status: 'processing',
        createdAt: serverTimestamp()
      });

      for (const row of rows) {
        try {
          // Basic validation: Code is mandatory for deduplication
          const code = String(row['Код'] || '').trim();
          if (!code || !row['Итого']) {
            rejectedCount++;
            continue;
          }

          // Check for existing booking with same code in this project
          const bookingPath = `projects/${projectId}/bookings`;
          const q = query(
            collection(db, bookingPath),
            where("code", "==", code)
          );
          const existing = await getDocs(q);

          const bookingDate = processDate(row['Дата брони']);
          const saleDate = processDate(row['Дата продажи']);
          const checkIn = processDate(row['Заезд']);
          const checkOut = processDate(row['Выезд']);

          // Determine sellerUid
          let sellerUid: string | null = null;
          if (type === 'sellers_report') {
            sellerUid = user.uid;
          } else {
            sellerUid = null; 
          }

          const bookingData: any = {
            projectId,
            sellerUid,
            code,
            source: row['Источник'] || 'Unknown',
            sourceFileType: type,
            sourceFileName: file.name,
            
            // Raw data for safety
            bookingDateRaw: bookingDate.raw,
            saleDateRaw: saleDate.raw,
            checkInRaw: checkIn.raw,
            checkOutRaw: checkOut.raw,

            // Normalized ISO strings
            bookingDateIso: bookingDate.iso,
            saleDateIso: saleDate.iso,
            checkInIso: checkIn.iso,
            checkOutIso: checkOut.iso,

            // Month keys for filtering
            bookingMonthKey: bookingDate.monthKey,
            saleMonthKey: saleDate.monthKey || bookingDate.monthKey,
            checkInMonthKey: checkIn.monthKey,

            // Error flags
            dateParseError: bookingDate.error || checkIn.error,

            category: row['Категория'] || 'Unknown',
            roomNumber: String(row['Номер'] || ''),
            total: Number(row['Итого']),
            status: (row['Дата отмены'] && row['Дата отмены'] !== '-') ? 'cancelled' : 'active',
            updatedAt: serverTimestamp()
          };

          if (!existing.empty) {
            const existingDoc = existing.docs[0];
            const existingData = existingDoc.data();

            // Deduplication logic: 
            // If we are uploading a sellers_report and the existing record 
            // was from a full_bookings_report, we might want to "claim" it 
            // by setting the sellerUid.
            if (type === 'sellers_report' && !existingData.sellerUid) {
              bookingData.sellerUid = user.uid;
            } else if (type === 'full_bookings_report' && existingData.sellerUid) {
              // If it already has a seller, don't overwrite it with null from full report
              bookingData.sellerUid = existingData.sellerUid;
            }

            await updateDoc(doc(db, bookingPath, existingDoc.id), bookingData);
            updatedCount++;
          } else {
            await addDoc(collection(db, bookingPath), {
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
      
      await logAction({
        action: 'import_success',
        actor_uid: user.uid,
        actor_role: actorRole,
        project_id: projectId,
        after_json: { 
          fileName: file.name, 
          type, 
          stats: { new: newCount, updated: updatedCount, rejected: rejectedCount } 
        }
      });

      toast.success(`Отчет (${type === 'sellers_report' ? 'Продажи' : 'Общий'}) успешно обработан`);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Upload error:", error);
      handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}/uploads`);
      toast.error("Ошибка при загрузке файла");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'sellers_report' | 'full_bookings_report') => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      processFile(file, type);
    } else if (file) {
      toast.error("Пожалуйста, выберите файл Excel (.xlsx)");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sellers Report Upload */}
        <div className={`border-2 border-dashed rounded-3xl p-8 text-center space-y-4 transition-all ${
          uploading ? 'border-indigo-500/50 bg-indigo-500/5 opacity-50 pointer-events-none' : 'border-white/10 hover:border-indigo-500/30 hover:bg-white/5'
        }`}>
          <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mx-auto">
            <FileUp className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Отчет продажника</p>
            <p className="text-slate-500 text-xs">Ваши личные продажи</p>
          </div>
          <input 
            type="file" 
            accept=".xlsx,.xls"
            onChange={(e) => handleFileSelect(e, 'sellers_report')}
            className="hidden" 
            id="sellers-upload"
          />
          <label 
            htmlFor="sellers-upload"
            className="inline-block bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-xs cursor-pointer transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
          >
            Загрузить продажи
          </label>
        </div>

        {/* Full Bookings Report Upload */}
        <div className={`border-2 border-dashed rounded-3xl p-8 text-center space-y-4 transition-all ${
          uploading ? 'border-indigo-500/50 bg-indigo-500/5 opacity-50 pointer-events-none' : 'border-white/10 hover:border-emerald-500/30 hover:bg-white/5'
        }`}>
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mx-auto">
            <FileUp className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Общий отчет</p>
            <p className="text-slate-500 text-xs">Все бронирования отеля</p>
          </div>
          <input 
            type="file" 
            accept=".xlsx,.xls"
            onChange={(e) => handleFileSelect(e, 'full_bookings_report')}
            className="hidden" 
            id="full-upload"
          />
          <label 
            htmlFor="full-upload"
            className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold text-xs cursor-pointer transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
          >
            Загрузить общий
          </label>
        </div>
      </div>

      {uploading && (
        <div className="flex items-center justify-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10 animate-pulse">
          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
          <span className="text-sm text-slate-400 font-medium">Обработка данных...</span>
        </div>
      )}

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
