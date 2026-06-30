import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TreeApi } from 'react-arborist';
import { AuthBar } from './components/AuthBar';
import { NodeDetailPanel } from './components/NodeDetailPanel';
import { TreeEditor } from './components/TreeEditor';
import {
  fetchPublishedSha,
  fetchRemoteTaxonomy,
  loadPublishedTaxonomy,
  saveTaxonomyViaPullRequest,
} from './lib/github';
import {
  clearDraft,
  clearRemoteSha,
  downloadJson,
  loadDraft,
  loadRemoteSha,
  saveDraft,
  saveRemoteSha,
} from './lib/storage';
import {
  cloneDocument,
  findNode,
  fromArboristData,
  toArboristData,
  updateNode,
  type ArboristNodeData,
  type TaxonomyDocument,
  type TaxonomyNode,
} from './lib/taxonomy';
import './App.css';

function documentFromTreeData(data: ArboristNodeData[]): TaxonomyDocument {
  const rootData = data[0];
  if (!rootData) {
    throw new Error('Tree data is empty.');
  }
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    root: fromArboristData(rootData),
  };
}

export default function App() {
  const treeRef = useRef<TreeApi<ArboristNodeData> | null>(null);
  const [document, setDocument] = useState<TaxonomyDocument | null>(null);
  const [baselineJson, setBaselineJson] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [remoteSha, setRemoteSha] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    if (!document) return false;
    return JSON.stringify(document) !== baselineJson;
  }, [document, baselineJson]);

  const applyDocument = useCallback((next: TaxonomyDocument, sha?: string | null) => {
    const cloned = cloneDocument(next);
    setDocument(cloned);
    setBaselineJson(JSON.stringify(cloned));
    saveDraft(cloned);
    if (sha) {
      setRemoteSha(sha);
      saveRemoteSha(sha);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const draft = loadDraft();
      const published = await loadPublishedTaxonomy();
      const storedSha = loadRemoteSha();

      if (draft && JSON.stringify(draft) !== JSON.stringify(published)) {
        applyDocument(draft, storedSha);
      } else {
        applyDocument(published, storedSha);
      }

      try {
        const remote = await fetchRemoteTaxonomy();
        setRemoteSha(remote.sha);
        saveRemoteSha(remote.sha);
      } catch {
        // Signed-out users or unconfigured GitHub cannot fetch remote SHA.
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load taxonomy.');
    } finally {
      setIsLoading(false);
    }
  }, [applyDocument]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!document || !isDirty) return;
    saveDraft(document);
  }, [document, isDirty]);

  const treeData = useMemo(() => {
    if (!document) return [];
    return [toArboristData(document.root)];
  }, [document]);

  const selectedNode = useMemo(() => {
    if (!document || !selectedId) return null;
    return findNode(document.root, selectedId);
  }, [document, selectedId]);

  const handleTreeChange = (data: ArboristNodeData[]) => {
    const next = documentFromTreeData(data);
    setDocument(next);
    setSaveMessage(null);
  };

  const handleNodeUpdate = (id: string, changes: Partial<TaxonomyNode>) => {
    if (!document) return;
    const nextRoot = updateNode(document.root, id, (node) => ({
      ...node,
      ...changes,
      metadata: changes.metadata ?? node.metadata,
      tags: changes.tags ?? node.tags,
    }));
    setDocument({ ...document, updatedAt: new Date().toISOString(), root: nextRoot });
    setSaveMessage(null);
  };

  const handleSave = async () => {
    if (!document) return;
    setIsSaving(true);
    setSaveMessage(null);
    setError(null);

    try {
      let sha = remoteSha;
      if (!sha) {
        const remote = await fetchRemoteTaxonomy();
        sha = remote.sha;
      }

      const result = await saveTaxonomyViaPullRequest(document, sha);
      setSaveMessage(`Pull request created: ${result.pullRequestUrl}`);
      const latestSha = await fetchPublishedSha();
      if (latestSha) {
        setRemoteSha(latestSha);
        saveRemoteSha(latestSha);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save taxonomy.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReload = async () => {
    clearDraft();
    clearRemoteSha();
    setSaveMessage(null);
    await loadInitialData();
  };

  const handleDiscardDraft = async () => {
    clearDraft();
    setSaveMessage(null);
    const published = await loadPublishedTaxonomy();
    applyDocument(published, remoteSha);
  };

  if (isLoading) {
    return <main className="app"><p className="status">Loading taxonomy…</p></main>;
  }

  if (!document) {
    return <main className="app"><p className="status error">{error ?? 'No taxonomy loaded.'}</p></main>;
  }

  return (
    <main className="app">
      <AuthBar
        isDirty={isDirty}
        isSaving={isSaving}
        saveMessage={saveMessage}
        onSave={() => void handleSave()}
        onExport={() => downloadJson(document)}
        onReload={() => void handleReload()}
        onDiscardDraft={() => void handleDiscardDraft()}
      />

      {error && <p className="banner error">{error}</p>}

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search labels, slugs, or tags"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <div className="workspace">
        <div className="treePanel">
          <TreeEditor
            data={treeData}
            selectedId={selectedId}
            searchTerm={searchTerm}
            onSelect={setSelectedId}
            onChange={handleTreeChange}
            treeRef={treeRef}
          />
        </div>
        <div className="detailPanel">
          <NodeDetailPanel node={selectedNode} onUpdate={handleNodeUpdate} />
        </div>
      </div>
    </main>
  );
}
