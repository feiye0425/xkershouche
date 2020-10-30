<?php
namespace app\admin\controller;
use \think\Controller;
/**
 *
 */
class Wenda extends Common
{
    public function cate()
    {
        $news_model = model("Newsfenlei");
        if (request()->isAjax()) {
            $post = input('post.');
            foreach ($post as $key => $value) {
                db("newsfenlei")->where('id',$key)->update(['order'=>$value]);
            }
            $list = db("newsfenlei")->order('order desc')->select();
            $wenda = $news_model->getNews($list);
            $this->assign("wenda",$wenda);
            return view('cateajaxpage');
        } else {
            $list = db("newsfenlei")->order('order desc')->select();
            $wenda = $news_model->getNews($list);
            $this->assign("wenda",$wenda);
            return view();
        }

    }

    public function cateadd($id='')
    {
        $cate_find = db('newsfenlei')->find($id);
        $this->assign('cate',$cate_find);
        return view();
    }

    public function cateaddhanddle()
    {
        db('newsfenlei')->insert(input('post.'));
        $this->redirect('admin/wenda/cate');
    }

    public function checkNameCateAjax()
    {
        if (request()->isAjax()) {
            $validate = validate("NewsCate");
            return $validate->check(input('post.'));
        } else {
            $this->redirect('admin/wenda/cate');
        }

    }

    public function catedel($id='')
    {
        $wenda_model = model("Newsfenlei");
        $wendacate_del_result = $new_model->newsCateDel($id);
        if ($wendacate_del_result) {
            $this->success("分类删除成功",'admin/wenda/cate');
        } else {
            $this->error("分类删除失败",'admin/wenda/cate');
        }

    }

    public function cateupd($id='')
    {
        $cate_find = db("newsfenlei")->find($id);
        if (empty($cate_find)) {
            $this->error("该分类不存在",'admin/wenda/cate');
        }
        // if ($cate_find['pid']!=0) {
            $cate_parent = db("newsfenlei")->find($cate_find['pid']);
            $cate_find['pname'] = $cate_parent['name'];
        // }
        $this->assign("cate",$cate_find);
        // dump($cate_find);
        return view();
    }

    public function cateupdhanddle()
    {
        if (!request()->isPost()) {
            $this->redirect('admin/wenda/cate');
        }
        $cate_upd_result = db("newsfenlei")->update(input('post.'));
        if ($cate_upd_result) {
            $this->success('分类修改成功',"admin/wenda/cate");
        } else {
            $this->error('分类修改失败','admin/wenda/cate');
        }

    }

    public function lst()
    {
        $field = 'n.id as nid,title,author,name,addtime,updtime,clicks,keywords,description,content';
        $wenda_select = db('wenda')
        ->order('updtime desc')
        ->alias('n')
        ->join('newsfenlei f','n.pid=f.id')
        ->field($field)->paginate(15);
        // dump($news_select);
        $this->assign('wenda',$wenda_select);
        return view();
    }
    public function add()
    {
        $news_model = model("Newsfenlei");
        $list = db("newsfenlei")->order('order desc')->select();
        $cate = $news_model->getNews($list);
        $this->assign("cate",$cate);
        return view();
    }
    public function addhanddle()
    {
        if (!request()->isPost()) {
            $this->redirect('admin/wenda/lst');
        }
        $data = input('post.');
        $data['addtime'] = strtotime('now');
        $data['updtime'] = strtotime('now');
        $wenda_add_result = db('wenda')->insert($data);
        if ($wenda_add_result) {
            $this->success("文章添加成功",'admin/wenda/lst');
        } else {
            $this->error("文章添加失败",'admin/wenda/lst');
        }
    }
    public function upd($id='')
    {
        $field = 'n.id as nid,title,author,addtime,updtime,clicks,keywords,description,content,n.pid as npid';
        $wenda_find = db('wenda')->alias('n')
        ->join('newsfenlei f','n.pid=f.id')
        ->field($field)->find($id);
        if (empty($wenda_find)) {
            $this->redirect('admin/wenda/lst');
        }
        $this->assign('wenda',$news_find);

        $news_model = model("Newsfenlei");
        $list = db("newsfenlei")->order('order desc')->select();
        $cate = $news_model->getNews($list);
        $this->assign("cate",$cate);
        return view();
    }


    public function updhanddle()
    {
        if (!request()->isPost()) {
            $this->redirect('admin/wenda/lst');
        }
        $wenda_upd_result = db("wenda")->update(input('post.'));
        if ($wenda_upd_result!==false) {
            $this->success("文章修改成功",'admin/wenda/lst');
        } else{
            $this->error("文章修改失败",'admin/wenda/lst');
        }
    }





    public function del($id='')
    {
        
        $wenda_find = db("wenda")->find($id);
        if (!empty($wenda_find)) {

            $wenda_del_result = db("wenda")->delete($wenda_find);

            
            if ($wenda_del_result) {
                $this->success('文章删除成功');
            } else {
                $this->error('文章删除失败');
            }
        } else {
            $this->redirect("admin/wenda/lst");
        }
    }











}
