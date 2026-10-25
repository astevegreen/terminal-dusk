// How bash splits a command line, for bash-guard: every simple command bash would run, including the ones
// inside $(…), backticks and <(…), wherever those appear outside single quotes: inside double quotes, in a
// here-string, and in a here-document whose end word is unquoted. Only single-quoted text, escaped characters,
// quoted here-documents and comments stay text.
//
// segments(line) gives { list, complete, unsure }. Each item in list is one simple command:
//   words      its words. A word that is one quoted string loses its quotes; any other word keeps its text as
//              written (backslashes too, so a Windows path such as C:\x is still recognised).
//   redirects  files it writes (>, >>, &>, >|, <>, and >& a file name)
//   inputs     files it reads (<)
//   plain      true when bash reads every word as kept here: no backslashes, and each word either unquoted or
//              one quoted string. A $ or backtick still counts as plain; callers check for those themselves.
// complete is false when the line ends inside a quote, a substitution or a here-document, so bash would read
// something different from this, or nothing at all.
// unsure is true when the word `case` appears inside $(…) or <(…). If it starts a case statement, a ) there may end
// one of its patterns or the substitution. A pattern can itself be the word `case`, and bash also starts a statement
// after coproc, `function f` or `time -p`, so this reader can't always tell which: everything after may be misread.

const SPACE = new Set([" ", "\t", "\r"]);
const BREAKS = new Set([...SPACE, "\n", ";", "&", "|", "(", ")", "<", ">"]);
const OPS = ["&&", "||", ";;&", ";;", ";&", "|&", ";", "|", "&", "\n", "(", ")"];
const REDIRECT = /(?:\d+|\{[A-Za-z_]\w*\})?(<<<|<<-|<<|<>|<&|>&|&>>|&>|>>|>\||<|>)/y;
// Reserved words after which `case` and `esac` are still reserved words, not ordinary arguments.
const RESERVED = new Set(["{", "!", "if", "then", "else", "elif", "do", "while", "until", "time"]);

export function segments(line) {
  const out = { list: [], complete: true, unsure: false };
  scanner(String(line), out).list(0, false);
  return out;
}

// `\` then a newline (or \r\n) is a line continuation: bash removes both. Returns how many characters that is.
const continuation = (src, i) => {
  if (src[i] !== "\\") return 0;
  if (src[i + 1] === "\n") return 2;
  return src[i + 1] === "\r" && src[i + 2] === "\n" ? 3 : 0;
};

function scanner(src, out) {
  const heredocs = []; // here-documents whose bodies start after the next newline

  // A command list from i, up to the end or, inside $(…) or <(…), the `)` that closes it. Returns the index after.
  function list(i, nested) {
    const fresh = () => ({ words: [], redirects: [], inputs: [], plain: true });
    let cur = fresh();
    let depth = 0;
    const cases = []; // the ( depth each open `case` started at: a ) at that depth ends one of its patterns
    let redirect = null;
    const finish = () => {
      if (cur.words.length || cur.redirects.length || cur.inputs.length) out.list.push(cur);
      cur = fresh();
      redirect = null;
    };
    const add = ({ value, plain, raw }) => {
      if (redirect === null) {
        if (plain && cur.words.every((x) => RESERVED.has(x))) {
          if (value === "case") cases.push(depth);
          else if (value === "esac") cases.pop();
        }
        out.unsure ||= nested && value === "case";
        cur.words.push(value);
        cur.plain &&= plain;
      } else if (redirect === "<<" || redirect === "<<-") {
        heredocs.push({ end: raw.replace(/["'\\]/g, ""), tabs: redirect === "<<-", text: /["'\\]/.test(raw) });
      } else if (["<&", ">&"].includes(redirect) && /^(\d+|-)$/.test(value)) {
        // copies a file number, such as 2>&1: no file involved
      } else if (redirect === "<" || redirect === "<&") cur.inputs.push(value);
      else if (redirect !== "<<<") cur.redirects.push(value);
      redirect = null;
    };
    while (i < src.length) {
      const c = src[i];
      if (SPACE.has(c)) {
        i++;
        continue;
      }
      if (continuation(src, i)) {
        i += continuation(src, i);
        continue;
      }
      if (c === "#") {
        while (i < src.length && src[i] !== "\n") i++;
        continue;
      }
      if (c === "\n") {
        finish();
        i = bodies(i + 1);
        continue;
      }
      if (c === ")" && cases.length && depth === cases.at(-1)) {
        finish(); // the end of a pattern such as `x)` in `case $v in x) …;; esac`
        i++;
        continue;
      }
      if (nested && c === ")" && depth === 0) {
        finish();
        return i + 1;
      }
      if ((c === "<" || c === ">") && src[i + 1] === "(") {
        const end = list(i + 2, true);
        add({ value: src.slice(i, end), plain: true, raw: src.slice(i, end) });
        i = end;
        continue;
      }
      const r = redirectAt(i);
      if (r) {
        redirect = r.op;
        i = r.end;
        continue;
      }
      const op = OPS.find((o) => src.startsWith(o, i));
      if (op) {
        if (op === "(") depth++;
        if (op === ")") depth--;
        finish();
        i += op.length;
        continue;
      }
      const w = word(i);
      if (!w) {
        out.complete = false;
        finish();
        return src.length;
      }
      add(w);
      i = w.end;
    }
    if (nested) out.complete = false;
    finish();
    if (heredocs.length) out.complete = false;
    return i;
  }

  // A redirect operator at i, with any file number before it: { op, end }, or null.
  function redirectAt(i) {
    REDIRECT.lastIndex = i;
    const m = REDIRECT.exec(src);
    return m && { op: m[1], end: REDIRECT.lastIndex };
  }

  // One word from i, up to the next space or operator character: { value, plain, raw, end }.
  // Null when a quote or substitution is left open.
  function word(i) {
    let raw = "";
    const kinds = []; // "u" for a run of unquoted text, "q" for a quoted string
    let simple = true;
    const take = (end, kind) => {
      raw += src.slice(i, end);
      if (kind === "q" || kinds.at(-1) !== "u") kinds.push(kind);
      i = end;
    };
    while (i < src.length && !BREAKS.has(src[i])) {
      const c = src[i];
      if (continuation(src, i)) i += continuation(src, i);
      else if (c === "\\") {
        simple = false;
        take(Math.min(i + 2, src.length), "u");
      } else if (c === "'") {
        const close = src.indexOf("'", i + 1);
        if (close < 0) return null;
        take(close + 1, "q");
      } else if (c === '"') {
        const r = dquote(i + 1);
        if (!r) return null;
        simple &&= !r.escaped;
        take(r.end, "q");
      } else if (c === "$" || c === "`") {
        const r = c === "$" ? dollar(i, false) : backtick(i, false);
        if (!r) return null;
        simple &&= !r.escaped;
        take(r.end, "u");
      } else take(i + 1, "u");
    }
    const plain = simple && (kinds.every((k) => k === "u") || kinds.length === 1);
    return { value: raw.replace(/^(["'])(.*)\1$/s, "$2"), plain, raw, end: i };
  }

  // A double-quoted string from just after its opening quote: { end, escaped }, or null when it never closes.
  function dquote(i) {
    let escaped = false;
    while (i < src.length) {
      const c = src[i];
      if (c === '"') return { end: i + 1, escaped };
      if (c === "\\") {
        escaped = true;
        i += 2;
      } else if (c === "$" || c === "`") {
        const r = c === "$" ? dollar(i, true) : backtick(i, true);
        if (!r) return null;
        i = r.end;
      } else i++;
    }
    return null;
  }

  // What starts with $: $(…) and $((…)), ${…}, $'…' and $"…", or a plain $NAME (whose name is ordinary text).
  function dollar(i, quoted) {
    const next = src[i + 1];
    if (next === "(") {
      const end = src[i + 2] === "(" ? arithmetic(i + 3) : -1;
      return { end: end > 0 ? end : list(i + 2, true) };
    }
    if (next === "{") return braces(i + 2, quoted);
    if (!quoted && next === "'") {
      for (let j = i + 2; j < src.length; j++) {
        if (src[j] === "\\") j++;
        else if (src[j] === "'") return { end: j + 1, escaped: true };
      }
      return null;
    }
    if (!quoted && next === '"') {
      const r = dquote(i + 2);
      return r && { end: r.end, escaped: true };
    }
    return { end: i + 1 };
  }

  // $((…)) from just after `$((`: the index after its `))`, or -1 when it isn't arithmetic after all
  // (such as `$((cd x; ls) )`), which bash then reads as a command substitution.
  function arithmetic(i) {
    let depth = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === "$" || c === "`") {
        const r = c === "$" ? dollar(i, true) : backtick(i, true);
        if (!r) return -1;
        i = r.end;
        continue;
      }
      if (c === ")") {
        if (depth === 0) return src[i + 1] === ")" ? i + 2 : -1;
        depth--;
      } else if (c === "(") depth++;
      else if (c === "\\") i++;
      i++;
    }
    return -1;
  }

  // ${…} from just after `${`, with quotes and substitutions inside: { end }, or null when it never closes.
  function braces(i, quoted) {
    while (i < src.length) {
      const c = src[i];
      if (c === "}") return { end: i + 1 };
      if (c === "\\") i += 2;
      else if (c === "'" && !quoted) {
        const close = src.indexOf("'", i + 1);
        if (close < 0) return null;
        i = close + 1;
      } else if (c === '"') {
        const r = dquote(i + 1);
        if (!r) return null;
        i = r.end;
      } else if (c === "$" || c === "`") {
        const r = c === "$" ? dollar(i, quoted) : backtick(i, quoted);
        if (!r) return null;
        i = r.end;
      } else i++;
    }
    return null;
  }

  // `…`: bash removes the backslash before $, ` and \ (and before " inside double quotes), then runs the rest.
  function backtick(i, quoted) {
    let body = "";
    for (let j = i + 1; j < src.length; j++) {
      const c = src[j];
      if (c === "`") {
        scanner(body, out).list(0, false);
        return { end: j + 1 };
      }
      if (c === "\\" && (["$", "`", "\\"].includes(src[j + 1]) || (quoted && src[j + 1] === '"'))) body += src[++j];
      else body += c;
    }
    return null;
  }

  // The bodies of the here-documents waiting for this newline, from i. Returns the index after the last one.
  // An unquoted end word means bash expands $(…) and backticks in the body; a quoted one keeps it as text.
  function bodies(i) {
    while (heredocs.length) {
      const { end, tabs, text } = heredocs.shift();
      const start = i;
      let stop = -1;
      while (i < src.length && stop < 0) {
        const nl = src.indexOf("\n", i);
        let line = src.slice(i, nl < 0 ? src.length : nl).replace(/\r$/, "");
        if (tabs) line = line.replace(/^\t+/, "");
        if (line === end) stop = i;
        i = nl < 0 ? src.length : nl + 1;
      }
      if (stop < 0) out.complete = false;
      if (!text) expand(src.slice(start, stop < 0 ? src.length : stop));
    }
    return i;
  }

  // The substitutions in a here-document's unquoted body.
  function expand(body) {
    const inner = scanner(body, out);
    let i = 0;
    while (i < body.length) {
      const c = body[i];
      if (c === "\\") i += 2;
      else if (c === "$" || c === "`") {
        const r = c === "$" ? inner.dollar(i, true) : inner.backtick(i, true);
        if (!r) {
          out.complete = false;
          return;
        }
        i = r.end;
      } else i++;
    }
  }

  return { list, dollar, backtick };
}
