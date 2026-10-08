"use client";

import { useEffect, useState } from "react";

import type {
  Project,
  ProjectCreateInput,
  ProjectType,
  ProjectUpdateInput,
} from "@/lib/api";

const projectTypes: Array<{ value: ProjectType; label: string }> = [
  { value: "concept", label: "Concept" },
  { value: "interior", label: "Interior" },
  { value: "mixed", label: "Mixed" },
];

type ProjectFormProps = {
  mode: "create" | "edit";
  initialProject?: Project;
  isSubmitting: boolean;
  error?: string | null;
  onCancel?: () => void;
  onSubmit: (input: ProjectCreateInput | ProjectUpdateInput) => void;
};

export function ProjectForm({
  mode,
  initialProject,
  isSubmitting,
  error,
  onCancel,
  onSubmit,
}: ProjectFormProps) {
  const [name, setName] = useState(initialProject?.name ?? "");
  const [description, setDescription] = useState(
    initialProject?.description ?? ""
  );
  const [projectType, setProjectType] = useState<ProjectType>(
    initialProject?.project_type ?? "concept"
  );
  const [city, setCity] = useState(initialProject?.city ?? "");
  const [climate, setClimate] = useState(initialProject?.climate ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialProject?.name ?? "");
    setDescription(initialProject?.description ?? "");
    setProjectType(initialProject?.project_type ?? "concept");
    setCity(initialProject?.city ?? "");
    setClimate(initialProject?.climate ?? "");
  }, [initialProject]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setValidationError("Project name is required.");
      return;
    }

    setValidationError(null);
    onSubmit({
      name: trimmedName,
      project_type: projectType,
      description: description.trim(),
      city: city.trim(),
      climate: climate.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {(validationError || error) && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {validationError || error}
        </div>
      )}

      <div>
        <label htmlFor={`${mode}-project-name`} className="field-label">
          Project name
        </label>
        <input
          id={`${mode}-project-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Courtyard House"
          disabled={isSubmitting}
          className="field-input"
          autoComplete="off"
        />
      </div>

      <div>
        <label htmlFor={`${mode}-project-type`} className="field-label">
          Project type
        </label>
        <select
          id={`${mode}-project-type`}
          value={projectType}
          onChange={(event) => setProjectType(event.target.value as ProjectType)}
          disabled={isSubmitting}
          className="field-input"
        >
          {projectTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${mode}-project-description`} className="field-label">
          Description <span className="font-normal text-neutral-400">Optional</span>
        </label>
        <textarea
          id={`${mode}-project-description`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What are you exploring?"
          disabled={isSubmitting}
          className="field-input min-h-24 resize-y"
          rows={3}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${mode}-project-city`} className="field-label">
            City <span className="font-normal text-neutral-400">Optional</span>
          </label>
          <input
            id={`${mode}-project-city`}
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="e.g. Pune"
            disabled={isSubmitting}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor={`${mode}-project-climate`} className="field-label">
            Climate <span className="font-normal text-neutral-400">Optional</span>
          </label>
          <input
            id={`${mode}-project-climate`}
            value={climate}
            onChange={(event) => setClimate(event.target.value)}
            placeholder="e.g. Tropical wet and dry"
            disabled={isSubmitting}
            className="field-input"
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="button-secondary"
          >
            Cancel
          </button>
        )}
        <button type="submit" disabled={isSubmitting} className="button-primary">
          {isSubmitting
            ? mode === "create"
              ? "Creating project..."
              : "Saving changes..."
            : mode === "create"
              ? "Create project"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}