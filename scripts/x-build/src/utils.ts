import { type CommandModule } from 'yargs';

export function defineCommandModule<T, U>(m: CommandModule<T, U>) {
  return m;
}
