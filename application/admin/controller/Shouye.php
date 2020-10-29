<?php
namespace app\admin\controller;
use \think\Controller;
/**
 *
 */
class Shouye extends Common
{


    public function bannerlist()
    /*banner列表*/
    {

        $bannerlist = db('banner')->select();
        $this->assign('bannerlist',$bannerlist);
        return view();
    }




    public function banneradd()
    /*添加banner界面*/
    {

        $bannerlist = db('banner')->select();
        $this->assign('bannerlist',$bannerlist);

        $banner_select = db('banner')->select();
        $this->assign('banner_select',$banner_select);
        return view();
    }




    public function banneraddhanddle()
    /*banner添加提交处理*/
    {
        $post = request()->post();

        $file1 = request()->file('banner_thumb');
        
        if (empty($file1)) {
            $this->error('请上传banner图片');
        }


        // 移动到框架应用根目录/public/uploads/ 目录下
        $info1 = $file1->move('../public/uploads/shouye/');
        if($info1){
            $thumb_new = ('../public/uploads/shouye/').$info1->getSaveName();
            $post['banner_thumb'] = $thumb_new;

            
        }else{
            // 上传失败获取错误信息



            return $file1->getError();
        }



        $banner_add_result = db('banner')->insert($post);
        if($banner_add_result){
              $this ->success('成功','shouye/banneradd');
        }
      else{
      $this ->error('上传失败','shouye/banneradd');

      }
       
    }




    



}
