type Illustrated={image:string|null;fullImage?:string};
/** Retain the first representative of each verified artwork identity. */
export function uniqueIllustrations<T extends Illustrated>(cards:T[],identities:Record<string,string>={}):T[]{
 const seen=new Set<string>();
 return cards.filter(card=>{const image=card.fullImage||card.image;if(!image)return false;const key=identities[image]||image;if(seen.has(key))return false;seen.add(key);return true;});
}
