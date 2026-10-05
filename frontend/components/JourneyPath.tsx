const steps = [
  { label: "Learn", detail: "Join a training programme" },
  { label: "Certify", detail: "Pass assessments, earn credentials" },
  { label: "Connect", detail: "Build a verified skill profile" },
  { label: "Grow", detail: "Find work or start a venture" },
];

export default function JourneyPath() {
  return (
    <ol className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {steps.map((step, i) => (
        <li
          key={step.label}
          className="relative rounded-lg border border-black/10 bg-white px-5 py-4"
          style={{ animation: `fade-up 0.5s ease-out ${i * 0.12}s both` }}
        >
          <span className="font-display text-2xl text-coop-saffron">{`0${i + 1}`}</span>
          <p className="font-display text-lg font-medium text-indigo mt-1">{step.label}</p>
          <p className="text-sm text-coop-slate mt-1">{step.detail}</p>
        </li>
      ))}
      <style>{`
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ol>
  );
}
