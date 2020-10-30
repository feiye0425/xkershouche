<?php
namespace app\admin\controller;
use \think\Controller;
/**
 *
 */
class Baike extends Common
{

    public function lst()
    {
/*        $field = 'n.id as nid,title,author,addtime,updtime,clicks,c_id,keywords,description';

        $baike_select = db('baike')

        ->alias('n')

        ->join('cate f','n.c_id=f.cate_id')

        ->field($field)->paginate(15);*/


        $baike = db('baike')->select();

        $cate = db('cate')->select();



/*最终要取出与表一对应的cate_id 的cate_name，并返回给baike表填充到c_name*/
                $zuijia= array();
               $aa=array();
              foreach ($baike as $key => $value) {





                $cc=  $value['cate_id'];
/*              $q= array($cc);
                $aa=  array_merge($aa, $q);*/
                    foreach($cate as $key1 => $value1){
                    if($value1['cate_id']=$cc){
                $zuijia= $value1['cate_name'];
                $zuijia2= array($zuijia);
                $baike3=array_push($value,$zuijia2);
                dump($baike3);

}

                }


                };
               




/*    $result = db([['baike']=>'b',['cate']=>'c'])->field('b.cate_id,c.cate_id')->where('c.cate_id=b.cate_id')->select();*/



        $this->assign('baike',$baike);

        return view();

    }


    public function add()
    {

        $cate_select = db('cate')->select();
        $cate_model = model('Cate');


        $cate_list1 = $cate_model->getChildren($cate_select);
        //获取无限级分类列表
        $this->assign('cate_list1',$cate_list1);



        return view();
    }


    public function addhanddle()
    {
        if (!request()->isPost()) {
            $this->redirect('admin/baike/lst');
        }
        $data = input('post.');
        $data['addtime'] = strtotime('now');
        $data['updtime'] = strtotime('now');
        $baike_add_result = db('baike')->insert($data);
        if ($baike_add_result) {
            $this->success("文章添加成功",'admin/baike/lst');
        } else {
            $this->error("文章添加失败",'admin/baike/lst');
        }

    }

    public function upd($id='')
    {
        $field = 'n.id as nid,title,author,name,addtime,updtime,clicks,keywords,description,content,n.pid as npid';
        $baike_find = db('baike')->alias('n')
        ->join('cate f','n.pid=f.id')
        ->field($field)->find($id);
        if (empty($baike_find)) {
            $this->redirect('admin/baike/lst');
        }
        $this->assign('baike',$baike_find);

        $cate_model = model("Newsfenlei");
        $list = db("cate")->order('order desc')->select();
        $cate = $cate_model->getNews($list);
        $this->assign("cate",$cate);
        return view();
    }


    public function updhanddle()
    {
        if (!request()->isPost()) {
            $this->redirect('admin/baike/lst');
        }
        $baike_upd_result = db("baike")->update(input('post.'));
        if ($baike_upd_result!==false) {
            $this->success("文章修改成功",'admin/baike/lst');
        } else{
            $this->error("文章修改失败",'admin/baike/lst');
        }
    }





    public function del($id='')
    {
        
        $baike_find = db("baike")->find($id);
        if (!empty($baike_find)) {

            $baike_del_result = db("baike")->delete($baike_find);

            
            if ($baike_del_result) {
                $this->success('文章删除成功');
            } else {
                $this->error('文章删除失败');
            }
        } else {
            $this->redirect("admin/baike/lst");
        }
    }











}
