type Example = { args: unknown[]; expected: unknown; explanation: string };

function isExample(value: unknown): value is Example {
  return typeof value === "object" && value !== null &&
    "args" in value && Array.isArray(value.args) &&
    "expected" in value && "explanation" in value && typeof value.explanation === "string";
}

export function ProblemExamples({ examples }: { examples: unknown }) {
  if (!Array.isArray(examples) || !examples.length || !examples.every(isExample)) {
    return <pre tabIndex={0} role="region" aria-label="Problem examples">{JSON.stringify(examples, null, 2) ?? "No examples available."}</pre>;
  }
  return <div className="problem-examples">
    {examples.map((example, index) => <section className="problem-example" key={index} aria-label={`Example ${index + 1}`}>
      <h4>Example {index + 1}</h4>
      <p className="eyebrow">Input arguments (in signature order)</p>
      <pre tabIndex={0} role="region" aria-label={`Example ${index + 1} input`}>{JSON.stringify(example.args, null, 2)}</pre>
      <p className="eyebrow">Expected output</p>
      <pre tabIndex={0} role="region" aria-label={`Example ${index + 1} expected output`}>{JSON.stringify(example.expected, null, 2)}</pre>
      <p className="arena-text">{example.explanation}</p>
    </section>)}
  </div>;
}
