import { summarizeComplaint } from '../src/index.js';

if (process.env.SUMMARIZATION_PROVIDER !== 'google_genai') {
  throw new Error('Set SUMMARIZATION_PROVIDER=google_genai in .env before running the live check.');
}

if (!process.env.GEMINI_API_KEY?.trim()) {
  throw new Error('Set GEMINI_API_KEY in .env before running the live check.');
}

try {
  const result = await summarizeComplaint(
    'Synthetic complaint CMP-LIVE-CHECK: students report that the classroom projector is not working during scheduled lectures.',
    {
      complaint_id: 'CMP-LIVE-CHECK',
      onProviderStatus: (status) => {
        process.stdout.write(`Provider status: ${status.provider}/${status.provider_status}\n`);
      }
    }
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Google GenAI live verification failed.'}\n`);
  process.exitCode = 1;
}
