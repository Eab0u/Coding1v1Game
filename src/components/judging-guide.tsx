export function JudgingGuide() {
  return <aside className="judging-guide" aria-label="How your solution is judged">
    <details className="judging-details">
    <summary>How your solution is judged</summary>
    <p>Examples illustrate the problem. Submissions are checked against hidden tests, including cases beyond these examples. Matching the examples alone does not guarantee a correct solution.</p>
    <ol>
      <li>Most hidden tests passed.</li>
      <li>Lower median CPU time across three runs on the largest tests.</li>
      <li>Earlier submission time if correctness and CPU time tie.</li>
    </ol>
    <p>Your best judged submission counts at the deadline. A weaker later attempt does not replace it. Editor changes count only after you submit them.</p>
    </details>
  </aside>;
}
