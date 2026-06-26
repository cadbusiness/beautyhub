"use client";

import { useState, useTransition } from "react";
import type { AIAction } from "@/modules/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { runAiAction, type RunAiActionResult } from "./actions";

type Props = {
  actions: Pick<AIAction, "name" | "description">[];
};

type Message =
  | { role: "system"; text: string }
  | { role: "user"; text: string }
  | { role: "result"; result: RunAiActionResult };

export function AssistantClient({ actions }: Props) {
  const [selectedAction, setSelectedAction] = useState<string>(
    actions[0]?.name ?? "",
  );
  const [paramsJson, setParamsJson] = useState("{}");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      text: "Choisis une action ci-dessous ou saisis une requete (bientot disponible).",
    },
  ]);
  const [pending, startTransition] = useTransition();

  function selectAction(name: string) {
    setSelectedAction(name);
    if (name === "institut.create_client") {
      setParamsJson(
        JSON.stringify(
          { email: "", full_name: "", phone: "" },
          null,
          2,
        ),
      );
    } else if (name === "institut.list_clients") {
      setParamsJson(JSON.stringify({ limit: 20 }, null, 2));
    } else {
      setParamsJson("{}");
    }
  }

  function execute(params: unknown) {
    const json = JSON.stringify(params);
    const label = selectedAction || "action";
    setMessages((prev) => [
      ...prev,
      { role: "user", text: `${label}\n${json}` },
    ]);

    startTransition(async () => {
      const result = await runAiAction(selectedAction, json);
      setMessages((prev) => [...prev, { role: "result", result }]);
    });
  }

  function handleJsonSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAction) return;
    let params: unknown;
    try {
      params = paramsJson.trim() ? JSON.parse(paramsJson) : {};
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "result", result: { ok: false, error: "JSON invalide." } },
      ]);
      return;
    }
    execute(params);
  }

  const selected = actions.find((a) => a.name === selectedAction);

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Actions disponibles
          </h2>
          {actions.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Aucune action IA.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action.name}
                  type="button"
                  variant={selectedAction === action.name ? "primary" : "outline"}
                  onClick={() => selectAction(action.name)}
                  className="text-xs"
                >
                  {action.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        {selected ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {selected.description}
          </p>
        ) : null}
      </Card>

      <Card className="min-h-48 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Conversation
        </h2>
        <ul className="space-y-3">
          {messages.map((msg, i) => (
            <li
              key={i}
              className={
                msg.role === "system"
                  ? "text-sm italic text-slate-500"
                  : msg.role === "user"
                    ? "rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800"
                    : "rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
              }
            >
              {msg.role === "result" ? (
                msg.result.ok ? (
                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-emerald-700 dark:text-emerald-400">
                    {JSON.stringify(msg.result.data, null, 2)}
                  </pre>
                ) : (
                  <p className="text-red-600">{msg.result.error}</p>
                )
              ) : (
                <span className="whitespace-pre-wrap">{msg.text}</span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {selectedAction === "institut.create_client" ? (
        <CreateClientForm pending={pending} onSubmit={execute} />
      ) : selectedAction === "institut.list_clients" ? (
        <ListClientsForm pending={pending} onSubmit={execute} />
      ) : (
        <Card>
          <form onSubmit={handleJsonSubmit} className="space-y-4">
            <Field label="Action" htmlFor="action">
              <Select
                id="action"
                value={selectedAction}
                onChange={(e) => selectAction(e.target.value)}
              >
                {actions.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Parametres (JSON)" htmlFor="params">
              <Textarea
                id="params"
                value={paramsJson}
                onChange={(e) => setParamsJson(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
            </Field>
            <Button type="submit" disabled={pending || !selectedAction}>
              {pending ? "Execution..." : "Executer"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}

function CreateClientForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (params: unknown) => void;
}) {
  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onSubmit({
            email: String(fd.get("email") ?? "").trim(),
            full_name: String(fd.get("full_name") ?? "").trim(),
            phone: String(fd.get("phone") ?? "").trim() || undefined,
          });
        }}
        className="space-y-4"
      >
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Creer un client
        </h3>
        <Field label="Nom complet" htmlFor="full_name">
          <Input id="full_name" name="full_name" required placeholder="Marie Durand" />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="marie@email.com"
          />
        </Field>
        <Field label="Telephone" htmlFor="phone">
          <Input id="phone" name="phone" placeholder="06 12 34 56 78" />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Execution..." : "Executer"}
        </Button>
      </form>
    </Card>
  );
}

function ListClientsForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (params: unknown) => void;
}) {
  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onSubmit({
            limit: Number.parseInt(String(fd.get("limit") ?? "20"), 10),
          });
        }}
        className="space-y-4"
      >
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Lister les clients
        </h3>
        <Field label="Limite" htmlFor="limit">
          <Input
            id="limit"
            name="limit"
            type="number"
            min={1}
            max={100}
            defaultValue={20}
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Execution..." : "Executer"}
        </Button>
      </form>
    </Card>
  );
}
