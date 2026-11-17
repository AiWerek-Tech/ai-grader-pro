'use server';

import { dbAppendRow, generateId, sanitizeInput } from '@/lib/google-sheets';
import { logger } from '@/lib/logger';

// Schema AI_FEEDBACK: [id_fb, id_hasil, soal_no, ai_ans, correct_ans, id_guru, timestamp]

export async function submitAIFeedbackAction(
  idHasil: string,
  soalNo: number,
  aiAns: string,
  correctAns: string,
  guruId: string
) {
  try {
    if (!idHasil || soalNo === undefined || !correctAns) {
      throw new Error('id_hasil, soal_no, dan correct_ans wajib diisi.');
    }

    const id = generateId('FB');
    const ts = new Date().toISOString();

    await dbAppendRow('AI_FEEDBACK', [
      id,
      sanitizeInput(String(idHasil)),
      soalNo,
      sanitizeInput(String(aiAns || '?')),
      sanitizeInput(String(correctAns)),
      guruId,
      ts
    ]);

    await logger.info(
      'AI_FEEDBACK',
      `Feedback soal ${soalNo}: AI=${aiAns} → Benar=${correctAns}`,
      guruId
    );

    return {
      success: true,
      message: 'Feedback tersimpan. Terima kasih telah membantu meningkatkan akurasi AI.'
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
