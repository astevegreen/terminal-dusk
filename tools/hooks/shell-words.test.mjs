// How shell-words.mjs splits a command line into the simple commands bash would run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { segments } from "./shell-words.mjs";

// Each simple command as one line of words, sorted, so the tests don't depend on the order they were found in.
const commands = (line) => segments(line).list.map((s) => s.words.join(" ")).sort();
const complete = (line) => segments(line).complete;

test("splits on && || ; | & and newlines", () => {
  assert.deepEqual(commands("a && b || c; d | e & f\ng"), ["a", "b", "c", "d", "e", "f", "g"]);
  assert.deepEqual(commands("a\r\nb"), ["a", "b"]);
  assert.deepEqual(commands("(a; b) |& c"), ["a", "b", "c"]);
});

test("finds the commands inside $(…), backticks and <(…), at any depth", () => {
  assert.deepEqual(commands("echo $(a x)"), ["a x", "echo $(a x)"]);
  assert.deepEqual(commands("echo `a x`"), ["a x", "echo `a x`"]);
  assert.deepEqual(commands("diff <(a) >(b)"), ["a", "b", "diff <(a) >(b)"]);
  assert.deepEqual(commands("echo $(b $(c))"), ["b $(c)", "c", "echo $(b $(c))"]);
  assert.deepEqual(commands("echo $( (a; b) )"), ["a", "b", "echo $( (a; b) )"]);
});

test("finds them inside double quotes too, but not inside single quotes or after a backslash", () => {
  assert.deepEqual(commands('echo "x $(a) `b`"'), ["a", "b", "echo x $(a) `b`"]);
  assert.deepEqual(commands("echo 'x $(a) `b`'"), ["echo x $(a) `b`"]);
  assert.deepEqual(commands('echo "x \\$(a) \\`b\\`"'), ["echo x \\$(a) \\`b\\`"]);
  assert.deepEqual(commands("echo \\$HOME \\`a\\`"), ["echo \\$HOME \\`a\\`"]);
});

test("finds them inside ${…} and $((…)), which are not commands themselves", () => {
  assert.deepEqual(commands('echo "${X:-$(a)}"'), ["a", "echo ${X:-$(a)}"]);
  assert.deepEqual(commands("echo $((1 + $(a)))"), ["a", "echo $((1 + $(a)))"]);
  assert.deepEqual(commands("echo $((1<<2))\nb"), ["b", "echo $((1<<2))"]);
});

test("the ) after a case pattern doesn't end the $(…) around it", () => {
  const found = commands('echo "$(case x in x) a;; (y) b;; esac; c)"; d');
  for (const c of ["a", "b", "c", "d"]) assert.ok(found.includes(c), `${c} in ${JSON.stringify(found)}`);
  const sub = commands('echo "$( (case x in x) a;; esac); b )"');
  for (const c of ["a", "b"]) assert.ok(sub.includes(c), `${c} in ${JSON.stringify(sub)}`);
  assert.equal(complete('echo "$(case x in x) a;; esac)"'), true);
});

// A pattern can itself be the word `case` (`case x in x) a;; case) b;; esac`), and then the reader can't tell
// which ) closes the $(…), so whatever follows it may be misread.
test("a case starting a command inside $(…) or <(…) makes the reading unsure; anywhere else it doesn't", () => {
  const unsure = (line) => segments(line).unsure;
  for (const line of [
    'echo "$(case x in x) a;; esac)"',
    "cat <(case x in x) a;; esac)",
    "echo $(echo $(case x in x) a;; esac))",
    "echo $( (case x in x) a;; esac) )",
    "echo `echo $(case x in x) a;; esac)`",
    "cat <<EOF\n$(case x in x) a;; esac)\nEOF",
  ])
    assert.equal(unsure(line), true, line);
  for (const line of [
    "case x in x) a;; esac",
    "(case x in x) a;; esac)",
    "echo `case x in x) a;; esac`",
    'echo "$(echo case)"',
    "echo $(git log --grep=case)",
    "cat <<'EOF'\n$(case x in x) a;; esac)\nEOF",
  ])
    assert.equal(unsure(line), false, line);
});

test("a backtick inside backticks is escaped, and its command is found too", () => {
  assert.deepEqual(commands("echo `a \\`b\\``"), ["a `b`", "b", "echo `a \\`b\\``"]);
});

test("a here-document's body is skipped; its commands count only when the end word is unquoted", () => {
  assert.deepEqual(commands("cat <<EOF\n$(a) `b`\nEOF\nc"), ["a", "b", "c", "cat"]);
  assert.deepEqual(commands("cat <<'EOF'\n$(a) `b`\nEOF\nc"), ["c", "cat"]);
  assert.deepEqual(commands('cat <<"EOF"\n$(a)\nEOF\nc'), ["c", "cat"]);
  assert.deepEqual(commands("cat <<-EOF\n\t$(a)\n\tEOF\nc"), ["a", "c", "cat"]);
  assert.deepEqual(commands("cat <<EOF; d\nx\nEOF\nc"), ["c", "cat", "d"]);
  assert.deepEqual(commands("cat <<A <<B\nx\nA\ny\nB\nc"), ["c", "cat"]);
});

test("a commit message from a quoted here-document inside $(…) is one word", () => {
  const line = "git commit -m \"$(cat <<'EOF'\nFix it; don't push \"now\")\n\nSigned: x\nEOF\n)\" && git push";
  const { list, complete: done } = segments(line);
  assert.equal(done, true);
  assert.deepEqual(list.map((s) => s.words[0]).sort(), ["cat", "git", "git"]);
  const commit = list.find((s) => s.words[1] === "commit");
  assert.equal(commit.words.length, 4);
  assert.match(commit.words[3], /^\$\(cat <<'EOF'\nFix it; don't push "now"\)\n\nSigned: x\nEOF\n\)$/);
});

test("a here-string's text is not a command, but a $(…) in it is", () => {
  assert.deepEqual(commands('cat <<< "x $(a)"; b'), ["a", "b", "cat"]);
});

test("output redirects are kept as write targets, input redirects as read sources", () => {
  const [seg] = segments("a x 2>&1 >out 2>>log <in 3<>rw <&0 >&2 &>both >|clobber").list;
  assert.deepEqual(seg.words, ["a", "x"]);
  assert.deepEqual(seg.redirects, ["out", "log", "rw", "both", "clobber"]);
  assert.deepEqual(seg.inputs, ["in"]);
  assert.deepEqual(segments("a >&file").list[0].redirects, ["file"]);
  assert.deepEqual(segments('a > "CLAUDE.md"').list[0].redirects, ["CLAUDE.md"]);
});

test("a digit is a file number only right before < or >", () => {
  assert.deepEqual(segments("echo a2>x 12").list[0].words, ["echo", "a2", "12"]);
});

test("comments and line continuations are read the way bash reads them", () => {
  assert.deepEqual(commands("a # b; c\nd"), ["a", "d"]);
  assert.deepEqual(commands("# don't\nd"), ["d"]);
  assert.deepEqual(commands("a#b c"), ["a#b c"]);
  assert.deepEqual(commands("a \\\n  b"), ["a b"]);
  assert.deepEqual(commands("a --fo\\\nrce"), ["a --force"]);
  assert.deepEqual(commands('echo "x\n# y"; b'), ["b", "echo x\n# y"]);
});

test("one quoted string loses its quotes; anything else keeps its text as written", () => {
  assert.deepEqual(segments(`"gh" 'api' "a b" --'m' "-"X a\\b C:\\x`).list[0].words, ["gh", "api", "a b", "--'m'", '"-"X', "a\\b", "C:\\x"]);
});

test("a word is plain only when bash reads it as written, apart from one pair of quotes", () => {
  const plain = (w) => segments(w).list[0].plain;
  for (const w of ["gh", '"gh"', "'gh'", '"a b"', "$X", '"$X"']) assert.equal(plain(w), true, w);
  for (const w of ["--'m'", '"-"X', "a\\b", '"a\\"b"', "a'b'", "$'x'"]) assert.equal(plain(w), false, w);
});

test("a line that ends inside a quote, a substitution or a here-document is incomplete", () => {
  for (const line of ['a "b', "a 'b", "a $(b", "a `b", "a <(b", 'a "$(b)', "a ${b", "cat <<EOF\nx", "cat <<EOF"]) {
    assert.equal(complete(line), false, line);
  }
  for (const line of ["a", 'a "b"', "a $(b)", "cat <<EOF\nx\nEOF", "a\n", "a \\\n"]) assert.equal(complete(line), true, line);
});

test("the commands before an unclosed quote are still found", () => {
  assert.deepEqual(commands('a; b "c'), ["a", "b"]);
  assert.deepEqual(commands("a; b $(c"), ["a", "b $(c", "c"]);
});
