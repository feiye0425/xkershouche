<?php
namespace app\admin\controller;
use \think\Controller;
/**
 *
 */
class Shouyetags extends Common
{

    public function add()
    {
        return view();
    }
    public function addhanddle()
    {
        if (!request()->isPost()) {
            $this->redirect('admin/shouyetags/lst');
        }
        $data = input('post.');

        $tags_add_result = db('shouyetags')->insert($data);
        if ($tags_add_result) {
            $this->success("文章添加成功",'admin/shouyetags/lst');
        } else {
            $this->error("文章添加失败",'admin/shouyetags/lst');
        }
    }
  



    public function lst()
    {
        $tags_lst = db('shouyetags')->select();
        $this->assign('tags_lst',$tags_lst);
        return view();
    }



    public function upd($id='')
    {
        $tags_find = db('shouyetags')->find($id);

        $this->assign('tags_find',$tags_find);

        return view();
    }


    public function updhanddle()
    {
        if (!request()->isPost()) {
            $this->redirect('admin/shouyetags/lst');
        }
        $tags_upd_result = db("shouyetags")->update(input('post.'));
        if ($tags_upd_result!==false) {
            $this->success("修改成功",'admin/shouyetags/lst');
        } else{
            $this->error("修改失败",'admin/shouyetags/lst');
        }
    }





    public function del($id='')
    {
        
        $tags_find = db("shouyetags")->find($id);
        if (!empty($tags_find)) {

            $shouyetags = db("shouyetags")->delete($tags_find);

            
            if ($shouyetags) {
                $this->success('文章删除成功');
            } else {
                $this->error('文章删除失败');
            }
        } else {
            $this->redirect("admin/shouyetags/lst");
        }
    }




}
