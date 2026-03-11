import { execSync } from 'child_process';
try {
  const log = execSync('git log -p -2 services/kodik.ts').toString();
  console.log(log.substring(0, 2000));
} catch (e) {
  console.error(e.message);
}
