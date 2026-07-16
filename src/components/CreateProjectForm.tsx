"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { createProjectAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

type ClientOption = {
  id: string;
  businessName: string;
};

export function CreateProjectForm({ clients, defaultClientId, onboarding = false }: { clients: ClientOption[]; defaultClientId?: string; onboarding?: boolean }) {
  const initialClientId = defaultClientId && clients.some((client) => client.id === defaultClientId) ? defaultClientId : clients[0]?.id ?? "__new";
  const [clientId, setClientId] = useState(initialClientId);

  return (
    <form action={createProjectAction} className="grid gap-5">
      {onboarding ? <input type="hidden" name="onboarding" value="1" /> : null}
      <label>
        Project/job name
        <input name="title" placeholder="Bathroom renovation" required />
      </label>

      <label>
        Client
        <select name="clientId" value={clientId} onChange={(event) => setClientId(event.target.value)} required>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.businessName}
            </option>
          ))}
          <option value="__new">Add new client</option>
        </select>
      </label>

      {clientId === "__new" ? (
        <div className="grid gap-4 rounded-lg border border-line bg-white p-4">
          <label>
            Business/name
            <input name="newClientBusinessName" placeholder="Client business or person" required />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Contact name
              <input name="newClientContactName" />
            </label>
            <label>
              Email
              <input name="newClientEmail" type="email" />
            </label>
            <label>
              Phone
              <input name="newClientPhone" type="tel" />
            </label>
            <label>
              ABN
              <input name="newClientAbn" />
            </label>
          </div>
          <label>
            Address
            <textarea name="newClientAddress" />
          </label>
          <label>
            Client notes
            <textarea name="newClientNotes" />
          </label>
        </div>
      ) : null}

      <label>
        Hourly rate
        <input name="hourlyRate" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="95.00" required />
      </label>

      <label>
        Project notes
        <textarea name="notes" placeholder="Scope, billing notes, access details" />
      </label>

      <SubmitButton className="tap-primary" pendingLabel="Saving project...">
        <Save size={20} aria-hidden="true" />
        {onboarding ? "Save and log work" : "Save Project"}
      </SubmitButton>
    </form>
  );
}
