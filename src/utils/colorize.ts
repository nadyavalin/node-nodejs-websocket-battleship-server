export type Color = 'green' | 'cyan' | 'yellow' | 'red' | 'blue';
export type Style = 'bold' | 'underline' | 'reset';

export function colorize(text: string, color: Color, styles: Style[] = []): string {
  const colorCodes: Record<Color, string> = {
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
  };

  const styleCodes: Record<Style, string> = {
    bold: '\x1b[1m',
    underline: '\x1b[4m',
    reset: '\x1b[0m',
  };

  const codes = [colorCodes[color], ...styles.map((style) => styleCodes[style])].join('');

  return `${codes}${text}${styleCodes.reset}`;
}
