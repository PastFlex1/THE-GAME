import { useState, useEffect } from 'react';
import { collection, query, where, limit, onSnapshot, Firestore } from 'firebase/firestore';

export function useBranchCollection(
  firestore: Firestore | null,
  collectionName: string,
  isOwner: boolean,
  myBranchIds: string[],
  companyId: string | null | undefined,
  loadingProfile: boolean,
  ownerLimit = 10000,
  branchLimit = 10000,
  isSuperAdmin = false
) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const branchIdsKey = JSON.stringify(myBranchIds);

  useEffect(() => {
    if (!firestore || loadingProfile) {
      if (!loadingProfile) setIsLoading(false);
      return;
    }

    const unsubs: any[] = [];
    const combinedData: Record<string, any> = {};
    setIsLoading(true);

    if (isOwner) {
      if (!isSuperAdmin && !companyId) {
        setIsLoading(false);
        return;
      }
      
      const baseCol = collection(firestore, collectionName);
      const q = isSuperAdmin 
        ? query(baseCol, limit(ownerLimit)) 
        : query(baseCol, where('companyId', '==', companyId), limit(ownerLimit));
        
      const sub = onSnapshot(q, (snap) => {
        const arr: any[] = [];
        snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        setData(arr);
        setIsLoading(false);
      });
      unsubs.push(sub);
      return () => unsubs.forEach(u => u());
    }

    if (myBranchIds.length === 0) {
      setData([]);
      setIsLoading(false);
      return;
    }

    const chunks = [];
    for (let i = 0; i < myBranchIds.length; i += 30) {
      chunks.push(myBranchIds.slice(i, i + 30));
    }

    let isFirstLoadComplete = false;
    let chunksLoaded = 0;
    
    chunks.forEach(chunk => {
      const q = query(collection(firestore, collectionName), where('branchId', 'in', chunk), limit(branchLimit));
      const sub = onSnapshot(q, (snap) => {
        snap.docChanges().forEach(change => {
           if (change.type === 'removed') {
             delete combinedData[change.doc.id];
           } else {
             combinedData[change.doc.id] = { id: change.doc.id, ...change.doc.data() };
           }
        });
        
        setData(Object.values(combinedData));
        chunksLoaded++;
        if (chunksLoaded >= chunks.length && !isFirstLoadComplete) {
          isFirstLoadComplete = true;
          setIsLoading(false);
        }
      });
      unsubs.push(sub);
    });

    return () => unsubs.forEach(u => u());
  }, [firestore, collectionName, isOwner, branchIdsKey, companyId, loadingProfile, ownerLimit, branchLimit]);

  return { data, isLoading };
}
