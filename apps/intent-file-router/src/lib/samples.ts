export type Sample = {
  id: string;
  label: string;
  filename: string;
  content: string;
  expectRoutable: boolean;
};

export const SAMPLES: Sample[] = [
  {
    id: "valid-js",
    label: "Valid: JS header (// TARGET)",
    filename: "draft.md",
    content: `// TARGET: backend docs/notes.md
Hello from payload.
Second line.`,
    expectRoutable: true,
  },
  {
    id: "valid-html",
    label: "Valid: HTML header (<!-- TARGET -->) routing JSON",
    filename: "payload.json",
    content: `<!-- TARGET: frontend public/data/demo.json -->
{"ok":true}
`,
    expectRoutable: true,
  },
  {
    id: "invalid-not-line1",
    label: "Invalid: TARGET not on line 1",
    filename: "draft.md",
    content: `First line no target
// TARGET: backend docs/late.md
payload`,
    expectRoutable: false,
  },
  {
    id: "invalid-unknown-repo",
    label: "Invalid: unknown repo key",
    filename: "draft.md",
    content: `// TARGET: no-such-repo docs/x.md
payload`,
    expectRoutable: false,
  },
  {
    id: "invalid-traversal",
    label: "Invalid: path traversal",
    filename: "draft.md",
    content: `// TARGET: backend ../secrets.txt
payload`,
    expectRoutable: false,
  },
  {
    id: "invalid-deny-ext",
    label: "Invalid: denied extension",
    filename: "clip.mp4",
    content: `// TARGET: backend uploads/clip.mp4
payload`,
    expectRoutable: false,
  },
];
