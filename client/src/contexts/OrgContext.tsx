import React, { createContext, useContext, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

interface Organization {
  id: number;
  name: string;
  slug: string;
  apiKey: string;
  plan: string;
  botName: string | null;
  botPersonality: string | null;
  welcomeMessage: string | null;
  primaryColor: string | null;
  monthlyMessageLimit: number | null;
  maxDocuments: number | null;
  messagesUsedThisMonth: number | null;
  memberRole: string;
}

interface OrgContextType {
  currentOrg: Organization | null;
  organizations: Organization[];
  setCurrentOrg: (org: Organization | null) => void;
  isLoading: boolean;
}

const OrgContext = createContext<OrgContextType>({
  currentOrg: null,
  organizations: [],
  setCurrentOrg: () => {},
  isLoading: true,
});

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const { data: orgs, isLoading } = trpc.org.list.useQuery();

  useEffect(() => {
    if (orgs && orgs.length > 0 && !currentOrg) {
      // Try to restore from localStorage
      const savedOrgId = localStorage.getItem("intellichat_org_id");
      const savedOrg = savedOrgId ? orgs.find(o => o.id === parseInt(savedOrgId)) : null;
      setCurrentOrg((savedOrg || orgs[0]) as Organization);
    }
  }, [orgs, currentOrg]);

  const handleSetOrg = (org: Organization | null) => {
    setCurrentOrg(org);
    if (org) {
      localStorage.setItem("intellichat_org_id", String(org.id));
    } else {
      localStorage.removeItem("intellichat_org_id");
    }
  };

  return (
    <OrgContext.Provider value={{
      currentOrg,
      organizations: (orgs || []) as Organization[],
      setCurrentOrg: handleSetOrg,
      isLoading,
    }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
