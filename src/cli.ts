const args = process.argv.slice(2);
if (args[0] === 'doctor' || args.includes('--doctor')) {
  const { doctor } = await import('./doctor');
  process.exitCode = doctor();
} else if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write('Usage: piw [project-folder] [--demo] [--session session.jsonl]\n       piw doctor\n');
} else {
  await import('./main');
}
export {};
