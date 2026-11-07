import { useId } from "react";

type Example = { args: unknown[]; expected: unknown; explanation: string };

const scrollGuidance = "Long examples scroll sideways. Keyboard: focus an input or output and use the left and right arrow keys.";

function isExample(value: unknown): value is Example {
  return typeof value === "object" && value !== null &&
    "args" in value && Array.isArray(value.args) &&
    "expected" in value && "explanation" in value && typeof value.explanation === "string";
}

export function ProblemExamples({ examples }: { examples: unknown }) {
  const scrollHintId = useId();
  if (examples == null || (Array.isArray(examples) && examples.length === 0)) {
    return <aside className="example-format-guide" aria-label="Problem examples unavailable">
      <strong>No public examples available</strong>
      <p>Use the problem statement, constraints and function signature to guide your solution. Hidden tests still determine correctness.</p>
      <p>Return your result from the function; you do not need to read input or print the answer.</p>
    </aside>;
  }
  if (!Array.isArray(examples) || !examples.length || !examples.every(isExample)) {
    return <div className="problem-examples">
      <p id={scrollHintId} className="example-scroll-hint">Long examples scroll sideways. Keyboard: focus the examples and use the left and right arrow keys.</p>
      <pre tabIndex={0} role="region" aria-label="Problem examples" aria-describedby={scrollHintId}>{JSON.stringify(examples, null, 2) ?? "No examples available."}</pre>
    </div>;
  }
  return <div className="problem-examples">
    {examples.length > 1 && <nav className="example-navigation" aria-label="Example shortcuts">
      {examples.map((_, index) => <a key={index} href={`#${scrollHintId}-example-${index + 1}`}>Example {index + 1}</a>)}
    </nav>}
    <aside className="example-format-guide" aria-label="Example format guide">
      <details className="example-format-details">
        <summary>Reading these examples</summary>
        <p>Inputs and outputs use JSON notation. In Python, <code>true</code> is <code>True</code>, <code>false</code> is <code>False</code>, and <code>null</code> is <code>None</code>.</p>
        <p>The input list contains one value per function argument, in signature order. Complete the function and return its result; you do not need to read input or print the answer.</p>
      </details>
    </aside>
    <p id={scrollHintId} className="example-scroll-hint">{scrollGuidance}</p>
    {examples.map((example, index) => <section className="problem-example" key={index} aria-label={`Example ${index + 1}`}>
      <h4 id={`${scrollHintId}-example-${index + 1}`} tabIndex={-1}>Example {index + 1}</h4>
      <p className="eyebrow">Input arguments (in signature order)</p>
      <pre tabIndex={0} role="region" aria-label={`Example ${index + 1} input`} aria-describedby={scrollHintId}>{JSON.stringify(example.args, null, 2)}</pre>
      <p className="eyebrow">Expected output</p>
      <pre tabIndex={0} role="region" aria-label={`Example ${index + 1} expected output`} aria-describedby={scrollHintId}>{JSON.stringify(example.expected, null, 2)}</pre>
      <p className="arena-text">{example.explanation}</p>
    </section>)}
  </div>;
}
