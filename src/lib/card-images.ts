type ImageCard={image:string|null;thumbnail?:string;fullImage?:string;imageWidth?:number};
export function responsiveCardImages(card:ImageCard){
 const low=card.thumbnail||(card.image?`${card.image}/low.webp`:'');
 const high=card.fullImage||(card.image?`${card.image}/high.webp`:'');
 const lowWidth=low.includes('-215x300.png')?215:low.includes('name=small')?487:245;
 return {src:low,srcset:low!==high?`${low} ${lowWidth}w, ${high} ${card.imageWidth||600}w`:undefined,sizes:'(max-width: 640px) 50vw, (max-width: 900px) 33.33vw, (max-width: 1100px) 25vw, 20vw'};
}
