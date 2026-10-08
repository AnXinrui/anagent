/** 用参数替换技能正文中的 $ARGUMENTS、$ARGUMENTS[n] 和 $n 占位符。 */
export function replaceArguments(body: string, args: string[]): string {
  const placeholder = /\$ARGUMENTS(?:\[\d+\])?|\$\d+/g;

  return body.replace(placeholder, (match) => {
    if (match === "$ARGUMENTS") {
      return args.join(" ");
    }

    const index = match.startsWith("$ARGUMENTS")
      ? Number(match.match(/\d+/)?.[0])
      : Number(match.slice(1));
    return args[index] ?? "";
  });
}
