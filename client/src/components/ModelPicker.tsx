const MODELS = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", description: "Default — strong agent, good value" },
  { id: "claude-opus-4-8", label: "Opus 4.8", description: "Escalate for hard topics" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5", description: "Light topics, lowest cost" },
] as const;

interface ModelPickerProps {
  slug: string;
  currentModel: string;
  disabled?: boolean;
  onModelChange: (model: string) => void;
}

export function ModelPicker({ slug, currentModel, disabled, onModelChange }: ModelPickerProps) {
  async function handleChange(model: string) {
    try {
      await fetch(`/api/topics/${slug}/model`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      onModelChange(model);
    } catch {
      // ignore — model stays as-is
    }
  }

  return (
    <div className="flex items-center gap-1">
      {MODELS.map((m) => (
        <button
          key={m.id}
          title={m.description}
          disabled={disabled}
          onClick={() => handleChange(m.id)}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            currentModel === m.id
              ? "bg-blue-100 text-blue-700 font-medium"
              : "text-gray-500 hover:bg-gray-100 disabled:opacity-40"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
