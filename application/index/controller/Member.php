<?php
namespace app\index\controller;
use \think\Controller;
/**
 * 用户控制器
 */
class Member extends Common
{

    // 用户中心
    public function membercenter()
    {
        $member_find = db("member")->find(cookie("id"));
        $this->assign("member_find",$member_find);


        return view();
    }

    // 用户登出
    public function logout()
    {
        cookie("member",null);
        $this->success("退出成功！",'index/login/login');
    }

    // 用户二手车列表
    public function ershouchelst()
    {
        $status = array(
            'total'=>0,//总数
            'sold'=>0,//已售-1
            'shelf'=>0,//上架1
            'unshelf'=>0,//下架0
            'unaudited'=>0//未审核2
        );
        $member_model = model("Member");
        $member_get = $member_model->get(cookie('member')['id']);
        $member_get->cars;
        foreach ($member_get['cars'] as $key => $value) {
            switch ($value['status']) {
                case '1':
                    $status['shelf']++;
                    $status['total']++;
                    break;

                case '-1':
                    $status['sold']++;
                    $status['total']++;
                    break;

                case '0':
                    $status['unshelf']++;
                    $status['total']++;
                    break;

                case '2':
                    $status['unaudited']++;
                    $status['total']++;
                    break;

            }
            $value->carsimg;
        }
        $member_get['status'] = $status;
        $this->assign('carslist',$member_get);
        return view('memberershouchelist');
    }

    // 用户二手车添加界面
    public function erchoucheadd()
    {
        session("cars_img",null);
        $level_select = db("level")->select();
        $this->assign("level",$level_select);

        $selfattribute_select = db("selfattribute")
        ->where('isshow',1)
        ->order("order desc")
        ->select();
        $this->assign("self",$selfattribute_select);
        return view('memberershoucheadd');
    }

    public function brandJsonGet()
    {
        if (request()->isAjax()) {
            $member_model = model("Member");
            return $member_model->getBrand();
        } else {
            $this->redirect("index/member/membercenter");
        }

    }

    public function ershoucheaddhaddle1()
    {
        $post = input('post.');
        dump($post);
        // $arr1:关联模型数据
        $arr1 = array_slice($post,20,-1,true);
        // $arr2:表的数据
        $arr2 = array_diff($post,$arr1);
        db("cars")->insert($arr2);
        dump($arr2);
    }

    public function ershoucheaddhaddle()
    {
        if (request()->isPost()) {
            $arr1 = array();//关联模型数据
            $arr2 = array();//数据表数据

            if(!session('?cars_img')){
                $this->error('请上传图片');
            };
            $arr3 = session('cars_img');//图片数据
            foreach (input('post.') as $key => $value) {
                is_int($key)?$arr1[$key] = $value:$arr2[$key] = $value;
            }
            $arr2['insurance'] = strtotime($arr2['insurance']);
            $arr2['plate'] = strtotime($arr2['plate']);
            $arr2['inspect'] = strtotime($arr2['inspect']);
            $arr2['listtime'] = strtotime("now");
            $arr2['member_id'] = cookie('member')['id'];
            $arr2['full_name'] = db('brand')->where('id',$arr2['brand_level1'])->value('name')
            ." ".db('brand')->where('id',$arr2['brand_level2'])->value('name')
            ." ".db('brand')->where('id',$arr2['brand_level3'])->value('name')
            ." ".db('carmodel')->where('id',$arr2['carmodel'])->value('style')
            ."款 ".db('carmodel')->where('id',$arr2['carmodel'])->value('edition');
            \think\Db::transaction(function () use($arr2,$arr1,$arr3){
                $cars_id = db("cars")->insertGetId($arr2);
                $cars_model = model('\app\admin\model\Cars');
                $cars_get = $cars_model->get($cars_id);
                foreach ($arr1 as $key => $value) {
                    // code...
                    $cars_get->selfattribute()->save($key,['selfattribute_value'=>$value]);
                }

                foreach($arr3 as $key => $value){
                    $cars_get->carsimg()->save(['url'=>str_replace('\\','/',$value)]);
                }
            });
            session('cars_img',null);
            $this->redirect("index/member/ershouchelst");
        } else {
            $this->redirect("index/member/membercenter");
        }

    }

    public function carsuploads()
    {
        // static $arr = array();
        // 获取表单上传文件 例如上传了001.jpg
        $file = request()->file('file');
        // 移动到框架应用根目录/uploads/ 目录下
        $info = $file->move( '../uploads/webuploaderdemo');
        if($info){
            // cookie('img',$arr);
            return $info->getSaveName();
        }
    }
    public function carsuploads0()
    {
        // static $arr = array();
        // 获取表单上传文件 例如上传了001.jpg
        $file = request()->file('file');
        // 移动到框架应用根目录/uploads/ 目录下
        $info = $file->move( '../uploads/cars');
        if($info){
            session('cars_img.'.$info->getSaveName(),'cars/'.$info->getSaveName());
            return $info->getSaveName();
        }
    }

    public function webuploader()
    {
        return view();
    }

    public function ershouchedel($id='')
    {
        $cars_del_result = db('cars')->where('member_id',cookie('member')['id'])->delete($id);
        if ($cars_del_result) {
            $this->success('车辆删除成功！');
        } else {
            $this->error("车辆删除失败！");
        }

    }

    public function rentcarslst()
    {
        $rentcars_select = db('rentcars')->where('member_id',cookie('member')['id'])->select();
        $this->assign('rentcars',$rentcars_select);
        // dump($rentcars_select);
        return view();
    }

    public function rentcarsadd()
    {
        return view();
    }

    public function rentcarsAddHanddle()
    {
        if (request()->isPost()) {
            // 先验证POST信息，此处略
            $data = input('post.');
            $file = request()->file('img');
            if (empty($file)) {
                $this->error('请选择图片');
            }
            $info = $file->move( '../uploads/rentcars');
            if($info){
                $data['listtime'] = strtotime("now");
                $data['member_id'] = cookie('member')['id'];
                $data['full_name'] = db('brand')->where('id',$data['brand_level1'])->value('name')
                ." ".db('brand')->where('id',$data['brand_level2'])->value('name')
                ." ".db('brand')->where('id',$data['brand_level3'])->value('name')
                ." ".db('carmodel')->where('id',$data['carmodel'])->value('style')
                ."款 ".db('carmodel')->where('id',$data['carmodel'])->value('edition');
                unset($data['brand_level1']);
                unset($data['brand_level2']);
                unset($data['brand_level3']);
                unset($data['carmodel']);
                $data['img'] = str_replace('\\','/','rentcars/'.$info->getSaveName());
                $rentcars_add_result = db('rentcars')->insert($data);
                if ($rentcars_add_result) {
                    $this->success('数据插入成功','index/member/rentcarslst');
                } else {
                    $this->error("数据插入失败");
                }

            }else{
                $this->error('图片上传失败');
            }
        } else{
            $this->redirect("index/member/membercenter");
        }
    }

    public function rentcarsdel($id='')
    {
        $rentcars_del_result = db('rentcars')->where('member_id',cookie('member')['id'])->delete($id);
        if ($rentcars_del_result) {
            $this->success('删除成功');
        } else {
            $this->error('删除失败');
        }
    }

    public function changepassword()
    {
        return view();
    }

    public function changepasswordHanddle()
    {
        if(!request()->isPost()){
            $this->redirect("index/member/membercenter");
        }
        if (cookie('member')['member_password']!=md5(input('post.oldpassword'))) {
            $this->error('原密码错误，请重新输入');
        }
        $password_upd_result = db('member')->update([
            'id'    =>  cookie('member')['id'],
            'member_password'   =>  md5(input('post.password'))
        ]);
        if ($password_upd_result!==false) {
            $this->updcookie();
            $this->success('密码修改成功');
        } else{
            $this->error('密码修改失败');
        }
    }
    public function changethumb()
    {
        return view();
    }

    public function changethumbHanddle()
    {
        $file = request()->file('thumb');
    // 移动到框架应用根目录/uploads/ 目录下
        $info = $file->move( '../uploads/member');
        if($info){
            $thumb_upd_result = db('member')->update([
                'id'    =>  cookie('member')['id'],
                'thumb' =>  str_replace('\\','/','member/'.$info->getSaveName())
            ]);
            if ($thumb_upd_result) {
                $this->updcookie();
                $this->success('头像修改成功','index/member/membercenter');
            } else {
                $this->error('头像修改失败','index/member/membercenter');
            }

        }else{
            $this->error('图片上传失败');
        }
    }

    private function updcookie()
    {
        $member = db('member')->find(cookie('member')['id']);
        if ($member) {
            cookie('member',$member);
        }
    }

}
