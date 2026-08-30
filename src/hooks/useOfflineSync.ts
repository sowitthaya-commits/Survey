'use client';

import { useState, useEffect } from 'react';
import { offlineDb } from '@/lib/offlineDb';
import { uploadSurveyBase64Images } from '@/lib/uploadHelper';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      syncPendingSurveys();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    updatePendingCount();

    // Auto-sync on mount if online
    if (navigator.onLine) {
      syncPendingSurveys();
    }

    const interval = setInterval(updatePendingCount, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  async function updatePendingCount() {
    try {
      const count = await offlineDb.draftSurveys
        .where('status')
        .equals('pending_sync')
        .count();
      setPendingCount(count);
    } catch (e) {
      console.error('Error counting pending surveys:', e);
    }
  }

  async function syncPendingSurveys() {
    if (!navigator.onLine || syncing) return;

    try {
      const pendingSurveys = await offlineDb.draftSurveys
        .where('status')
        .equals('pending_sync')
        .toArray();

      if (pendingSurveys.length === 0) return;

      setSyncing(true);
      setSyncError(null);
      console.log(`Starting sync for ${pendingSurveys.length} surveys...`);

      for (const survey of pendingSurveys) {
        try {
          // Upload base64 images first to prevent 413 Payload Too Large
          const preparedSurvey = await uploadSurveyBase64Images(survey);

          const response = await fetch('/api/surveys', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(preparedSurvey),
          });

          if (response.ok) {
            await offlineDb.draftSurveys.delete(survey.id);
            console.log(`Synced survey ${survey.projectName} successfully.`);
          } else {
            const errText = await response.text();
            throw new Error(`Server returned code ${response.status}: ${errText}`);
          }
        } catch (postErr: any) {
          console.error(`Sync post error for ${survey.projectName}:`, postErr);
          setSyncError(`ไม่สามารถส่งข้อมูลโครงการ "${survey.projectName}" ได้: ${postErr.message}`);
          break; // Stop syncing rest of queue to prevent loops on error
        }
      }
      
      await updatePendingCount();
    } catch (error: any) {
      console.error('Error during offline sync:', error);
      setSyncError(error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเพื่ออัปโหลด');
    } finally {
      setSyncing(false);
    }
  }

  return {
    isOnline,
    pendingCount,
    syncing,
    syncError,
    syncPendingSurveys,
    updatePendingCount,
  };
}
