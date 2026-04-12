import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import process from 'node:process';
import commandBuild from './command-build.ts';

(async () => {
  yargs(hideBin(process.argv))
    .command(commandBuild)
    .parse();
})();
