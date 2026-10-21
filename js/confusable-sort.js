// Pointer Events work for touch and mouse; only the drag handle initiates sorting.
function avsBindConfusableSort(root,onMove){
  if(!root)return;
  let drag=null;
  root.querySelectorAll('[data-confusable-drag]').forEach(handle=>{
    handle.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      const row=handle.closest('.confusableManageRow');if(!row)return;
      drag={id:e.pointerId,from:Number(row.dataset.sortIndex),to:Number(row.dataset.sortIndex),row};
      row.classList.add('confusableDragging');handle.setPointerCapture(e.pointerId);e.preventDefault();
    });
    handle.addEventListener('pointermove',e=>{
      if(!drag||drag.id!==e.pointerId)return;
      const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.confusableManageRow');
      if(target&&root.contains(target))drag.to=Number(target.dataset.sortIndex);
      root.querySelectorAll('.confusableManageRow').forEach(row=>row.classList.toggle('confusableDropTarget',Number(row.dataset.sortIndex)===drag.to));
    });
    const finish=e=>{
      if(!drag||drag.id!==e.pointerId)return;
      const {from,to}=drag;drag.row.classList.remove('confusableDragging');
      root.querySelectorAll('.confusableManageRow').forEach(row=>row.classList.remove('confusableDropTarget'));
      drag=null;if(from!==to)onMove(from,to);
    };
    handle.addEventListener('pointerup',finish);
    handle.addEventListener('pointercancel',()=>{if(drag){drag.row.classList.remove('confusableDragging');drag=null;}});
  });
}
